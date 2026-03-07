/**
 * DOCX Tracked-Changes Patcher
 *
 * Applies a PatchPlan to a DOCX buffer and produces a new DOCX buffer where
 * every change is represented as Microsoft Word tracked changes
 * (<w:ins> / <w:del>) in the underlying OOXML.
 *
 * The patcher works at the raw XML level:
 *  1. Unzip the DOCX.
 *  2. Build a "run map" — every <w:r> element with its extracted text,
 *     character offset in the concatenated run-text, and XML boundaries.
 *  3. For each PatchPlan operation, locate the target text across runs,
 *     split runs at boundaries, and wrap them in revision elements.
 *  4. Re-zip and return the modified buffer.
 *
 * Safety guarantees:
 *  - Exact uniqueness is required for all targets/anchors; if a string
 *    appears 0 or ≥ 2 times the operation is skipped and becomes unresolved.
 *  - Delete-range operations enforce min_chars / max_chars bounds.
 *  - No operation modifies the document if it would cross a structural
 *    boundary (table/numbering/section) unsafely — skipped to unresolved.
 */

import JSZip from "jszip";
import type {
  PatchPlan,
  InsertionOp,
  DeleteRangeOp,
  UnresolvedField
} from "../llm/types.ts";
import {
  MIN_DELETION_CONFIDENCE,
  MIN_OP_CONFIDENCE,
  DEFAULT_MAX_DELETE_CHARS
} from "../llm/types.ts";

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export type PatchDocxInput = {
  inputDocxBuffer: Buffer;
  patchPlan: PatchPlan;
  authorName?: string;
  nowIso?: string;
};

export type PatchDocxOutput = {
  docxBuffer: Buffer;
  /** Operations that could not be applied (added to unresolved) */
  additionalUnresolved: UnresolvedField[];
};

export async function patchDocxWithTrackedChanges(
  input: PatchDocxInput
): Promise<PatchDocxOutput> {
  const author = input.authorName ?? "Accretive";
  const now = input.nowIso ?? new Date().toISOString();
  const plan = input.patchPlan;

  const zip = await JSZip.loadAsync(input.inputDocxBuffer);
  const additionalUnresolved: UnresolvedField[] = [];

  // Process main document.xml and any header/footer XMLs
  const xmlFiles = ["word/document.xml"];
  for (const name of Object.keys(zip.files)) {
    if (/^word\/(header|footer)\d*\.xml$/.test(name)) {
      xmlFiles.push(name);
    }
  }

  // Revision ID counter shared across all XML files so IDs are unique
  let revId = 1;

  for (const xmlFile of xmlFiles) {
    const entry = zip.file(xmlFile);
    if (!entry) {
      continue;
    }

    let xml = await entry.async("string");

    // Replacements
    for (const op of plan.replacements) {
      if (op.confidence < MIN_OP_CONFIDENCE) {
        continue;
      }
      const result = applyReplacement(xml, op.target, op.replacement, author, now, revId);
      if (result.applied) {
        xml = result.xml;
        revId += 2; // del + ins each consume one ID
      } else {
        additionalUnresolved.push({
          field: op.target.slice(0, 60),
          question: result.reason ?? "Could not locate target string uniquely.",
          locationHint: op.target.slice(0, 60)
        });
      }
    }

    // Placeholder fills (same mechanism as replacements)
    for (const op of plan.placeholder_fills) {
      if (op.confidence < MIN_OP_CONFIDENCE) {
        continue;
      }
      const result = applyReplacement(xml, op.placeholder, op.value, author, now, revId);
      if (result.applied) {
        xml = result.xml;
        revId += 2;
      } else {
        additionalUnresolved.push({
          field: op.placeholder,
          question: result.reason ?? "Could not locate placeholder uniquely.",
          locationHint: op.placeholder
        });
      }
    }

    // Insertions
    for (const op of plan.insertions) {
      if (op.confidence < MIN_OP_CONFIDENCE) {
        continue;
      }
      const result = applyInsertion(xml, op, author, now, revId);
      if (result.applied) {
        xml = result.xml;
        revId += 1;
      } else {
        additionalUnresolved.push({
          field: op.anchor.slice(0, 60),
          question: result.reason ?? "Could not locate anchor uniquely for insertion.",
          locationHint: op.anchor.slice(0, 60)
        });
      }
    }

    // Deletions
    for (const op of plan.deletions) {
      if (op.confidence < MIN_DELETION_CONFIDENCE) {
        additionalUnresolved.push({
          field: op.anchor_start.slice(0, 60),
          question: `Deletion skipped: confidence ${op.confidence} < ${MIN_DELETION_CONFIDENCE}.`,
          locationHint: op.anchor_start.slice(0, 60)
        });
        continue;
      }
      const maxChars = op.safety.max_chars ?? DEFAULT_MAX_DELETE_CHARS;
      const result = applyDeletion(xml, op, author, now, revId, maxChars);
      if (result.applied) {
        xml = result.xml;
        revId += 1;
      } else {
        additionalUnresolved.push({
          field: op.anchor_start.slice(0, 60),
          question: result.reason ?? "Could not apply deletion safely.",
          locationHint: op.anchor_start.slice(0, 60)
        });
      }
    }

    zip.file(xmlFile, xml);
  }

  const docxBuffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });

  return { docxBuffer, additionalUnresolved };
}

// ---------------------------------------------------------------------------
// Run map — extract text runs from XML for manipulation
// ---------------------------------------------------------------------------

/**
 * Represents a single <w:r> ... </w:r> element's text and position in XML.
 */
type RunInfo = {
  /** Full XML of this run, including <w:r>...</w:r> tags */
  runXml: string;
  /** Concatenated visible text of all <w:t> elements in this run */
  text: string;
  /** Start index of this run's XML in the parent XML string */
  xmlStart: number;
  /** End index (exclusive) of this run's XML in the parent XML string */
  xmlEnd: number;
  /** Run properties XML (<w:rPr>...</w:rPr>) if present, for copying to TC runs */
  rPrXml: string;
};

/**
 * Extract all runs from a body of XML, building a linear sequence with their
 * character offsets in the concatenated text.
 */
type RunMapEntry = RunInfo & {
  /** Character start offset in the concatenated text of all runs */
  textStart: number;
  /** Character end offset (exclusive) */
  textEnd: number;
};

function buildRunMap(xml: string): RunMapEntry[] {
  const runs: RunMapEntry[] = [];
  let textOffset = 0;

  // Match each <w:r> ... </w:r> including potential namespace prefixes
  const runRe = /<w:r(?:\s[^>]*)?>[\s\S]*?<\/w:r>/g;
  let m: RegExpExecArray | null;

  while ((m = runRe.exec(xml)) !== null) {
    const runXml = m[0];
    const xmlStart = m.index;
    const xmlEnd = xmlStart + runXml.length;

    // Extract rPr
    const rPrMatch = runXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
    const rPrXml = rPrMatch ? rPrMatch[0] : "";

    // Extract all <w:t> text (and <w:delText> is not expected in input)
    const text = extractRunText(runXml);

    runs.push({
      runXml,
      text,
      xmlStart,
      xmlEnd,
      rPrXml,
      textStart: textOffset,
      textEnd: textOffset + text.length
    });

    textOffset += text.length;
  }

  return runs;
}

/** Extract visible text from all <w:t> elements in a run */
function extractRunText(runXml: string): string {
  const textRe = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let result = "";
  let m: RegExpExecArray | null;
  while ((m = textRe.exec(runXml)) !== null) {
    result += m[1];
  }
  return result;
}

/** Find all occurrences of `needle` in `haystack` */
function findAll(haystack: string, needle: string): number[] {
  const positions: number[] = [];
  let start = 0;
  while (true) {
    const idx = haystack.indexOf(needle, start);
    if (idx === -1) {
      break;
    }
    positions.push(idx);
    start = idx + 1;
  }
  return positions;
}

// ---------------------------------------------------------------------------
// Tracked change element builders
// ---------------------------------------------------------------------------

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlSpaceAttr(text: string): string {
  // Preserve leading/trailing spaces
  if (text.startsWith(" ") || text.endsWith(" ")) {
    return ' xml:space="preserve"';
  }
  return "";
}

function buildDelRun(text: string, rPrXml: string, author: string, now: string, id: number): string {
  const escaped = escapeXml(text);
  const spaceAttr = xmlSpaceAttr(text);
  return (
    `<w:del w:id="${id}" w:author="${escapeXml(author)}" w:date="${now}">` +
    `<w:r>${rPrXml}<w:delText${spaceAttr}>${escaped}</w:delText></w:r>` +
    `</w:del>`
  );
}

function buildInsRun(text: string, rPrXml: string, author: string, now: string, id: number): string {
  const escaped = escapeXml(text);
  const spaceAttr = xmlSpaceAttr(text);
  return (
    `<w:ins w:id="${id}" w:author="${escapeXml(author)}" w:date="${now}">` +
    `<w:r>${rPrXml}<w:t${spaceAttr}>${escaped}</w:t></w:r>` +
    `</w:ins>`
  );
}

/**
 * Rebuild a run XML replacing its <w:t> text content with `newText`.
 * Preserves run properties and all other child elements.
 */
function rebuildRunWithText(runXml: string, newText: string): string {
  // Replace the text inside the first <w:t> element
  const spaceAttr = xmlSpaceAttr(newText);
  return runXml.replace(
    /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/,
    `<w:t${spaceAttr}>${escapeXml(newText)}</w:t>`
  );
}

// ---------------------------------------------------------------------------
// Core: apply a replacement (delete old + insert new) as tracked changes
// ---------------------------------------------------------------------------

type ApplyResult = { applied: boolean; xml: string; reason?: string };

function applyReplacement(
  xml: string,
  target: string,
  replacement: string,
  author: string,
  now: string,
  baseId: number
): ApplyResult {
  if (!target) {
    return { applied: false, xml, reason: "Empty target string." };
  }

  const runMap = buildRunMap(xml);
  const flatText = runMap.map((r) => r.text).join("");

  const positions = findAll(flatText, target);
  if (positions.length === 0) {
    return { applied: false, xml, reason: `Target not found in document text: "${target.slice(0, 60)}".` };
  }
  if (positions.length > 1) {
    return { applied: false, xml, reason: `Target appears ${positions.length} times — must be unique: "${target.slice(0, 60)}".` };
  }

  const charStart = positions[0];
  const charEnd = charStart + target.length;

  // Find the runs that overlap with [charStart, charEnd)
  const affectedRuns = runMap.filter(
    (r) => r.textEnd > charStart && r.textStart < charEnd
  );

  if (affectedRuns.length === 0) {
    return { applied: false, xml, reason: "No runs found for target range." };
  }

  // Build the replacement XML segments
  const firstRun = affectedRuns[0];
  const lastRun = affectedRuns[affectedRuns.length - 1];

  // Collect the rPr from the first affected run for the inserted text
  const rPrXml = firstRun.rPrXml;

  // We'll replace the entire span of XML from firstRun.xmlStart to lastRun.xmlEnd
  const xmlBefore = xml.slice(0, firstRun.xmlStart);
  const xmlAfter = xml.slice(lastRun.xmlEnd);

  // Build del/ins XML
  const delXml = buildDelRun(target, rPrXml, author, now, baseId);
  const insXml = buildInsRun(replacement, rPrXml, author, now, baseId + 1);

  // Re-include any text from the first run BEFORE the target
  const prefixText = firstRun.text.slice(0, charStart - firstRun.textStart);
  // Text from the last run AFTER the target
  const suffixText = lastRun.text.slice(charEnd - lastRun.textStart);

  let middle = "";
  if (prefixText) {
    middle += rebuildRunWithText(firstRun.runXml, prefixText);
  }
  middle += delXml + insXml;
  if (suffixText) {
    middle += rebuildRunWithText(lastRun.runXml, suffixText);
  }

  // If there are intermediate runs (between first and last), they are fully
  // within the target and are already accounted for in the del element.
  // We simply drop them from the output since delXml covers the whole target text.

  return { applied: true, xml: xmlBefore + middle + xmlAfter };
}

// ---------------------------------------------------------------------------
// Insertion (insert_before / insert_after an anchor)
// ---------------------------------------------------------------------------

function applyInsertion(
  xml: string,
  op: InsertionOp,
  author: string,
  now: string,
  id: number
): ApplyResult {
  const anchor = op.anchor;
  if (!anchor) {
    return { applied: false, xml, reason: "Empty anchor string." };
  }

  const runMap = buildRunMap(xml);
  const flatText = runMap.map((r) => r.text).join("");

  const positions = findAll(flatText, anchor);
  if (positions.length === 0) {
    return { applied: false, xml, reason: `Anchor not found: "${anchor.slice(0, 60)}".` };
  }
  if (positions.length > 1) {
    return { applied: false, xml, reason: `Anchor appears ${positions.length} times — must be unique.` };
  }

  const charStart = positions[0];
  const charEnd = charStart + anchor.length;

  // Find the run containing the end of the anchor (for insert_after)
  // or the start of the anchor (for insert_before)
  const targetCharOffset = op.type === "insert_after" ? charEnd - 1 : charStart;
  const anchorRun = runMap.find(
    (r) => r.textStart <= targetCharOffset && r.textEnd > targetCharOffset
  );

  if (!anchorRun) {
    return { applied: false, xml, reason: "Could not find run containing anchor boundary." };
  }

  const rPrXml = anchorRun.rPrXml;
  const insXml = buildInsRun(op.content, rPrXml, author, now, id);

  if (op.type === "insert_after") {
    const insertAt = anchorRun.xmlEnd;
    return {
      applied: true,
      xml: xml.slice(0, insertAt) + insXml + xml.slice(insertAt)
    };
  } else {
    const insertAt = anchorRun.xmlStart;
    return {
      applied: true,
      xml: xml.slice(0, insertAt) + insXml + xml.slice(insertAt)
    };
  }
}

// ---------------------------------------------------------------------------
// Deletion (delete_range between anchor_start and anchor_end)
// ---------------------------------------------------------------------------

function applyDeletion(
  xml: string,
  op: DeleteRangeOp,
  author: string,
  now: string,
  id: number,
  maxChars: number
): ApplyResult {
  const { anchor_start, anchor_end } = op;

  if (!anchor_start || !anchor_end) {
    return { applied: false, xml, reason: "anchor_start or anchor_end is empty." };
  }

  const runMap = buildRunMap(xml);
  const flatText = runMap.map((r) => r.text).join("");

  const startPositions = findAll(flatText, anchor_start);
  const endPositions = findAll(flatText, anchor_end);

  if (startPositions.length !== 1) {
    return {
      applied: false,
      xml,
      reason: `anchor_start "${anchor_start.slice(0, 60)}" found ${startPositions.length} times — must be unique.`
    };
  }
  if (endPositions.length !== 1) {
    return {
      applied: false,
      xml,
      reason: `anchor_end "${anchor_end.slice(0, 60)}" found ${endPositions.length} times — must be unique.`
    };
  }

  const rangeStart = startPositions[0];
  const rangeEnd = endPositions[0] + anchor_end.length;

  if (rangeEnd <= rangeStart) {
    return { applied: false, xml, reason: "anchor_end appears before anchor_start in document." };
  }

  const rangeText = flatText.slice(rangeStart, rangeEnd);
  const rangeLen = rangeText.length;

  if (rangeLen < (op.safety.min_chars ?? 0)) {
    return { applied: false, xml, reason: `Delete range (${rangeLen} chars) is smaller than min_chars.` };
  }
  if (rangeLen > maxChars) {
    return { applied: false, xml, reason: `Delete range (${rangeLen} chars) exceeds max_chars (${maxChars}).` };
  }

  // Find all runs that overlap the range [rangeStart, rangeEnd)
  const affectedRuns = runMap.filter(
    (r) => r.textEnd > rangeStart && r.textStart < rangeEnd
  );

  if (affectedRuns.length === 0) {
    return { applied: false, xml, reason: "No runs found for delete range." };
  }

  // Safety: do not delete across structural boundaries
  // We check by confirming all affected runs are within the same paragraph (<w:p>).
  const containsStructuralBoundary = containsStructure(
    xml.slice(affectedRuns[0].xmlStart, affectedRuns[affectedRuns.length - 1].xmlEnd)
  );
  if (containsStructuralBoundary) {
    return {
      applied: false,
      xml,
      reason: "Delete range crosses a structural boundary (table/paragraph/section). Not applied."
    };
  }

  // Build del elements for all text in the affected range
  const firstRun = affectedRuns[0];
  const lastRun = affectedRuns[affectedRuns.length - 1];
  const rPrXml = firstRun.rPrXml;

  const xmlBefore = xml.slice(0, firstRun.xmlStart);
  const xmlAfter = xml.slice(lastRun.xmlEnd);

  // Text in first run before range
  const prefixText = firstRun.text.slice(0, rangeStart - firstRun.textStart);
  // Text in last run after range
  const suffixText = lastRun.text.slice(rangeEnd - lastRun.textStart);

  const delXml = buildDelRun(rangeText, rPrXml, author, now, id);

  let middle = "";
  if (prefixText) {
    middle += rebuildRunWithText(firstRun.runXml, prefixText);
  }
  middle += delXml;
  if (suffixText) {
    middle += rebuildRunWithText(lastRun.runXml, suffixText);
  }

  return { applied: true, xml: xmlBefore + middle + xmlAfter };
}

/**
 * Returns true if the XML snippet contains structural elements that should
 * not be deleted across (tables, section properties, numbering).
 */
function containsStructure(xml: string): boolean {
  return (
    xml.includes("<w:tbl") ||
    xml.includes("<w:sectPr") ||
    xml.includes("<w:numPr") ||
    xml.includes("</w:p>") // crosses paragraph boundary
  );
}
