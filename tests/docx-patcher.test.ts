/**
 * Unit tests for docxTrackedChangesPatcher.
 *
 * Uses a small programmatically-generated DOCX fixture (created via JSZip)
 * so the test has no external file dependency.
 *
 * The fixture DOCX contains:
 *   - A paragraph with party name "ACME CORP LIMITED" (to be replaced)
 *   - A paragraph with placeholder "{{LOAN_AMOUNT}}" (to be filled)
 *   - Two mutually-exclusive option blocks:
 *       "Sole Shareholder confirms" ... end marker "END SOLE"
 *       "All Shareholders confirm" ... end marker "END ALL"
 */

import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { patchDocxWithTrackedChanges } from "../src/server/docx/docxTrackedChangesPatcher.ts";
import type { PatchPlan } from "../src/server/llm/types.ts";

// ---------------------------------------------------------------------------
// Fixture builder
// ---------------------------------------------------------------------------

function buildMinimalDocxXml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body}
    <w:sectPr/>
  </w:body>
</w:document>`;
}

function para(text: string): string {
  return `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
}

async function buildFixtureDocx(): Promise<Buffer> {
  const bodyXml = [
    para("LOAN AGREEMENT"),
    para("Borrower: ACME CORP LIMITED"),
    para("Loan Amount: {{LOAN_AMOUNT}}"),
    para("Sole Shareholder confirms that the resolution was duly passed by the sole shareholder. END SOLE"),
    para("All Shareholders confirm that the resolution was passed at a meeting of shareholders. END ALL")
  ].join("\n");

  const docXml = buildMinimalDocxXml(bodyXml);

  const zip = new JSZip();
  zip.file("word/document.xml", docXml);
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`);

  return zip.generateAsync({ type: "nodebuffer" });
}

// ---------------------------------------------------------------------------
// Helper: read document.xml from a DOCX buffer
// ---------------------------------------------------------------------------

async function readDocumentXml(docxBuffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(docxBuffer);
  const entry = zip.file("word/document.xml");
  if (!entry) {
    throw new Error("word/document.xml not found in DOCX.");
  }
  return entry.async("string");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("patchDocxWithTrackedChanges: output is valid DOCX zip", async () => {
  const inputBuffer = await buildFixtureDocx();

  const emptyPlan: PatchPlan = {
    llm_model: "test",
    created_at: new Date().toISOString(),
    replacements: [],
    placeholder_fills: [],
    insertions: [],
    deletions: [],
    signing_block_updates: [],
    unresolved: []
  };

  const result = await patchDocxWithTrackedChanges({
    inputDocxBuffer: inputBuffer,
    patchPlan: emptyPlan
  });

  assert.ok(result.docxBuffer instanceof Buffer, "Output should be a Buffer");
  assert.ok(result.docxBuffer.length > 0, "Output buffer should not be empty");

  // Must be a valid ZIP
  const zip = await JSZip.loadAsync(result.docxBuffer);
  assert.ok(zip.file("word/document.xml"), "Output DOCX must contain word/document.xml");
  assert.equal(result.additionalUnresolved.length, 0, "No unresolved for empty plan");
});

test("patchDocxWithTrackedChanges: replacement adds w:del and w:ins", async () => {
  const inputBuffer = await buildFixtureDocx();

  const plan: PatchPlan = {
    llm_model: "test",
    created_at: new Date().toISOString(),
    replacements: [
      {
        type: "replace_exact",
        target: "ACME CORP LIMITED",
        replacement: "NEWCO LIMITED",
        reason: "Party name updated from transaction docs.",
        evidenceRefs: [{ docIndex: 0, docId: "tx1", excerpt: "NEWCO LIMITED as borrower" }],
        confidence: 0.95,
        requires_exact_match: true
      }
    ],
    placeholder_fills: [],
    insertions: [],
    deletions: [],
    signing_block_updates: [],
    unresolved: []
  };

  const result = await patchDocxWithTrackedChanges({ inputDocxBuffer: inputBuffer, patchPlan: plan });
  const xml = await readDocumentXml(result.docxBuffer);

  assert.ok(xml.includes("<w:del"), "Output XML must contain w:del element");
  assert.ok(xml.includes("<w:ins"), "Output XML must contain w:ins element");
  assert.ok(xml.includes("ACME CORP LIMITED"), "Deleted text must appear in w:delText");
  assert.ok(xml.includes("NEWCO LIMITED"), "Inserted text must appear in w:ins");
  assert.equal(result.additionalUnresolved.length, 0, "No unresolved for successful replacement");
});

test("patchDocxWithTrackedChanges: placeholder fill adds w:del and w:ins", async () => {
  const inputBuffer = await buildFixtureDocx();

  const plan: PatchPlan = {
    llm_model: "test",
    created_at: new Date().toISOString(),
    replacements: [],
    placeholder_fills: [
      {
        type: "fill_placeholder",
        placeholder: "{{LOAN_AMOUNT}}",
        value: "$500,000",
        reason: "Amount from term sheet",
        evidenceRefs: [],
        confidence: 0.98,
        requires_exact_match: true
      }
    ],
    insertions: [],
    deletions: [],
    signing_block_updates: [],
    unresolved: []
  };

  const result = await patchDocxWithTrackedChanges({ inputDocxBuffer: inputBuffer, patchPlan: plan });
  const xml = await readDocumentXml(result.docxBuffer);

  assert.ok(xml.includes("<w:del"), "Output must contain w:del for placeholder");
  assert.ok(xml.includes("<w:ins"), "Output must contain w:ins with filled value");
  assert.ok(xml.includes("$500,000"), "Filled value must appear in output");
});

test("patchDocxWithTrackedChanges: delete_range wraps range in w:del", async () => {
  const inputBuffer = await buildFixtureDocx();

  const plan: PatchPlan = {
    llm_model: "test",
    created_at: new Date().toISOString(),
    replacements: [],
    placeholder_fills: [],
    insertions: [],
    deletions: [
      {
        type: "delete_range",
        anchor_start: "Sole Shareholder confirms",
        anchor_end: "END SOLE",
        reason: "Deal has multiple shareholders; sole shareholder block is irrelevant.",
        evidenceRefs: [{ docIndex: 0, docId: "tx1", excerpt: "two shareholders" }],
        confidence: 0.9,
        safety: { requires_exact_match: true, min_chars: 5, max_chars: 5000 }
      }
    ],
    signing_block_updates: [],
    unresolved: []
  };

  const result = await patchDocxWithTrackedChanges({ inputDocxBuffer: inputBuffer, patchPlan: plan });
  const xml = await readDocumentXml(result.docxBuffer);

  assert.ok(xml.includes("<w:del"), "Output must contain w:del for deleted range");
  assert.ok(xml.includes("Sole Shareholder confirms"), "Deleted text must appear inside w:del");
  // The "All Shareholders" block should remain untouched
  assert.ok(xml.includes("All Shareholders confirm"), "Other option block must be preserved");
  assert.equal(result.additionalUnresolved.length, 0, "Successful deletion produces no unresolved");
});

test("patchDocxWithTrackedChanges: non-unique target becomes unresolved", async () => {
  const inputBuffer = await buildFixtureDocx();

  const plan: PatchPlan = {
    llm_model: "test",
    created_at: new Date().toISOString(),
    replacements: [
      {
        // "the resolution was" appears verbatim in BOTH option paragraphs
        type: "replace_exact",
        target: "the resolution was",
        replacement: "the resolution had been",
        reason: "test",
        evidenceRefs: [],
        confidence: 0.9,
        requires_exact_match: true
      }
    ],
    placeholder_fills: [],
    insertions: [],
    deletions: [],
    signing_block_updates: [],
    unresolved: []
  };

  const result = await patchDocxWithTrackedChanges({ inputDocxBuffer: inputBuffer, patchPlan: plan });

  assert.equal(result.additionalUnresolved.length, 1, "Non-unique target must produce an unresolved entry");
});

test("patchDocxWithTrackedChanges: deletion below confidence threshold becomes unresolved", async () => {
  const inputBuffer = await buildFixtureDocx();

  const plan: PatchPlan = {
    llm_model: "test",
    created_at: new Date().toISOString(),
    replacements: [],
    placeholder_fills: [],
    insertions: [],
    deletions: [
      {
        type: "delete_range",
        anchor_start: "Sole Shareholder confirms",
        anchor_end: "END SOLE",
        reason: "Low confidence deletion",
        evidenceRefs: [],
        confidence: 0.5, // below 0.85 threshold
        safety: { requires_exact_match: true, min_chars: 5, max_chars: 5000 }
      }
    ],
    signing_block_updates: [],
    unresolved: []
  };

  const result = await patchDocxWithTrackedChanges({ inputDocxBuffer: inputBuffer, patchPlan: plan });

  assert.equal(result.additionalUnresolved.length, 1, "Low-confidence deletion must be skipped to unresolved");
  // The text must NOT appear in a w:del element
  const xml = await readDocumentXml(result.docxBuffer);
  assert.ok(!xml.includes("<w:del"), "No deletion should have been applied");
});

test("patchDocxWithTrackedChanges: missing target becomes unresolved", async () => {
  const inputBuffer = await buildFixtureDocx();

  const plan: PatchPlan = {
    llm_model: "test",
    created_at: new Date().toISOString(),
    replacements: [
      {
        type: "replace_exact",
        target: "THIS STRING DOES NOT EXIST IN FIXTURE",
        replacement: "something",
        reason: "test",
        evidenceRefs: [],
        confidence: 0.95,
        requires_exact_match: true
      }
    ],
    placeholder_fills: [],
    insertions: [],
    deletions: [],
    signing_block_updates: [],
    unresolved: []
  };

  const result = await patchDocxWithTrackedChanges({ inputDocxBuffer: inputBuffer, patchPlan: plan });

  assert.equal(result.additionalUnresolved.length, 1, "Missing target must produce an unresolved entry");
});
