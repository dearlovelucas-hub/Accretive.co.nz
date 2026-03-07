/**
 * Two-step Anthropic wrapper for strict patch-plan generation.
 *
 * Step 1 — Extraction call:
 *   Extract structured deal facts, identify stale entity names, list
 *   detected placeholders, and identify mutually-exclusive option blocks.
 *
 * Step 2 — Patch plan call:
 *   Produce a strict JSON PatchPlan conforming to the types in ./types.ts.
 *   MUST NOT invent clauses, rewrite language, or produce prose outside JSON.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { PatchPlan } from "./types.ts";
import { validatePatchPlan } from "./types.ts";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_MODEL =
  process.env.ANTHROPIC_MODEL ??
  process.env.CLAUDE_MODEL ??
  "claude-3-5-sonnet-latest";

const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 60_000);

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

export type TransactionTextInput = {
  id: string;
  text: string;
};

export type GeneratePatchPlanInput = {
  templateText: string;
  transactionTexts: TransactionTextInput[];
  otherInfo?: string;
  placeholderList?: string[];
  constraints: {
    jurisdiction: "NZ";
    noNewClauses: true;
  };
  metadata: {
    jobId: string;
    orgId: string;
    userId: string;
  };
};

export type GeneratePatchPlanOutput = {
  patchPlan: PatchPlan;
  modelTrace?: object;
};

// ---------------------------------------------------------------------------
// Extraction step
// ---------------------------------------------------------------------------

type ExtractionResult = {
  parties: {
    role: string;
    name: string;
    oldNameInTemplate?: string;
  }[];
  directors: { name: string; partyRole?: string }[];
  shareholderCount?: number;
  keyDates: { label: string; value: string }[];
  keyAmounts: { label: string; value: string }[];
  governingLaw?: string;
  staleCandidates: { oldName: string; newName: string; confidence: number }[];
  detectedPlaceholders: string[];
  optionBlocks: {
    description: string;
    anchorStart: string;
    anchorEnd: string;
    shouldDelete: boolean;
    reason: string;
  }[];
};

const EXTRACTION_SYSTEM = `You are a legal document analysis assistant for New Zealand transactional law.
Extract structured deal facts from the provided documents. Return ONLY valid JSON matching the schema given in the prompt.
Never include prose outside the JSON object.`;

function buildExtractionPrompt(input: GeneratePatchPlanInput): string {
  const txSections = input.transactionTexts
    .map((t, i) => `--- Transaction Document ${i + 1} (id: ${t.id}) ---\n${t.text.slice(0, 15_000)}`)
    .join("\n\n");

  const templateExcerpt = input.templateText.slice(0, 8_000);
  const placeholdersNote = input.placeholderList?.length
    ? `Known template placeholders: ${input.placeholderList.join(", ")}`
    : "No pre-detected placeholders provided.";

  return `You are analysing a NZ legal document template and a set of transaction documents.

TEMPLATE EXCERPT (first 8 000 chars):
${templateExcerpt}

${placeholdersNote}

TRANSACTION DOCUMENTS:
${txSections}

${input.otherInfo ? `OTHER INFO:\n${input.otherInfo}` : ""}

Extract and return ONLY this JSON object (no markdown, no prose outside JSON):
{
  "parties": [
    { "role": "borrower|lender|vendor|purchaser|company|...", "name": "exact name from tx docs", "oldNameInTemplate": "stale name in template if detected or null" }
  ],
  "directors": [
    { "name": "director full name", "partyRole": "which party they are director of or null" }
  ],
  "shareholderCount": null,
  "keyDates": [{ "label": "e.g. Completion Date", "value": "e.g. 15 March 2025" }],
  "keyAmounts": [{ "label": "e.g. Purchase Price", "value": "e.g. $1,500,000" }],
  "governingLaw": "New Zealand or null",
  "staleCandidates": [
    { "oldName": "stale entity name in template", "newName": "correct name from tx docs", "confidence": 0.0 }
  ],
  "detectedPlaceholders": ["list of placeholder tokens found in template text"],
  "optionBlocks": [
    {
      "description": "short description of the option block",
      "anchorStart": "exact first few words of the block start",
      "anchorEnd": "exact last few words of the block end",
      "shouldDelete": true,
      "reason": "why this block should be deleted based on deal context"
    }
  ]
}`;
}

// ---------------------------------------------------------------------------
// Patch plan step
// ---------------------------------------------------------------------------

const PATCH_PLAN_SYSTEM = `You are a NZ legal document patching assistant operating under strict rules.

HARD RULES — violations are critical errors:
1. DO NOT invent new clauses, paragraphs, or legal language.
2. DO NOT rewrite or paraphrase template text.
3. ONLY propose: name/entity replacements, placeholder fills, deletion of mutually-exclusive option blocks, signing block director count updates.
4. Every target/placeholder/anchor MUST appear VERBATIM in the template.
5. Deletions require confidence >= 0.85 AND clear evidence from transaction docs.
6. If uncertain, add to "unresolved" — never guess.
7. Return ONLY valid JSON conforming exactly to the PatchPlan schema. No prose outside JSON.`;

function buildPatchPlanPrompt(
  input: GeneratePatchPlanInput,
  extraction: ExtractionResult
): string {
  const templateExcerpt = input.templateText.slice(0, 10_000);
  const txSummary = input.transactionTexts
    .map((t, i) => `Doc ${i} (id: ${t.id}): ${t.text.slice(0, 3_000)}`)
    .join("\n---\n");

  return `You are generating a STRICT patch plan to apply tracked changes to a NZ legal document template.

EXTRACTION SUMMARY (from step 1):
${JSON.stringify(extraction, null, 2)}

TEMPLATE (first 10 000 chars):
${templateExcerpt}

TRANSACTION DOCUMENTS (excerpts):
${txSummary}

${input.otherInfo ? `OTHER INFO:\n${input.otherInfo}` : ""}

OUTPUT REQUIREMENTS:
- Return ONLY a JSON object matching the PatchPlan schema below.
- All "target", "placeholder", "anchor", "anchor_start", "anchor_end" values MUST be verbatim substrings of the template.
- "replacement" and "value" MUST come directly from transaction documents — no invention.
- "content" in insertions MUST only fill a variable/placeholder segment, not create new clauses.
- "evidenceRefs" must include docIndex (0-based), docId, and excerpt ≤ 200 chars from that document.
- For deletions: confidence MUST be >= 0.85; safety.max_chars MUST be set conservatively (cap at 5000).
- Replacements of stale entity names must have exact target strings found in the template.
- If info is missing or ambiguous, add to "unresolved" — do NOT guess.

PatchPlan JSON schema:
{
  "llm_model": "${DEFAULT_MODEL}",
  "created_at": "<ISO timestamp>",
  "replacements": [
    {
      "type": "replace_exact",
      "target": "<verbatim string in template>",
      "replacement": "<verbatim replacement from tx docs>",
      "reason": "<brief reason>",
      "evidenceRefs": [{ "docIndex": 0, "docId": "<id>", "excerpt": "<≤200 chars>" }],
      "confidence": 0.0,
      "requires_exact_match": true
    }
  ],
  "placeholder_fills": [
    {
      "type": "fill_placeholder",
      "placeholder": "<exact placeholder token>",
      "value": "<value from tx docs>",
      "reason": "<brief reason>",
      "evidenceRefs": [...],
      "confidence": 0.0,
      "requires_exact_match": true
    }
  ],
  "insertions": [
    {
      "type": "insert_before|insert_after",
      "anchor": "<exact anchor in template>",
      "content": "<content — must fill a variable segment only>",
      "reason": "<brief reason>",
      "evidenceRefs": [...],
      "confidence": 0.0,
      "requires_exact_match": true
    }
  ],
  "deletions": [
    {
      "type": "delete_range",
      "anchor_start": "<exact start string>",
      "anchor_end": "<exact end string>",
      "reason": "<brief reason>",
      "evidenceRefs": [...],
      "confidence": 0.0,
      "safety": { "requires_exact_match": true, "min_chars": 0, "max_chars": 5000 }
    }
  ],
  "signing_block_updates": [
    {
      "type": "signing_block_update",
      "locationHint": "<e.g. EXECUTION>",
      "directorCount": 1,
      "directorNames": ["<name if known>"],
      "reason": "<brief reason>",
      "evidenceRefs": [...],
      "confidence": 0.0
    }
  ],
  "unresolved": [
    { "field": "<field name>", "question": "<what needs clarification>", "locationHint": "<optional>" }
  ]
}`;
}

// ---------------------------------------------------------------------------
// Helper: call Anthropic with timeout
// ---------------------------------------------------------------------------

async function callWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`LLM call timed out after ${timeoutMs}ms (${label})`)),
      timeoutMs
    );
  });

  try {
    const result = await Promise.race([promise, timeout]);
    clearTimeout(timer!);
    return result;
  } catch (err) {
    clearTimeout(timer!);
    throw err;
  }
}

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function extractJsonFromResponse(text: string): string {
  // Strip optional markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }
  // Find the first { ... } block
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    return text.slice(braceStart, braceEnd + 1);
  }
  return text.trim();
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generatePatchPlan(
  input: GeneratePatchPlanInput
): Promise<GeneratePatchPlanOutput> {
  const client = getClient();
  const now = new Date().toISOString();

  // -------------------------------------------------------------------------
  // Step 1: Extraction
  // -------------------------------------------------------------------------
  const extractionPrompt = buildExtractionPrompt(input);

  const extractionResponse = await callWithTimeout(
    client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 2_000,
      temperature: 0,
      system: EXTRACTION_SYSTEM,
      messages: [{ role: "user", content: extractionPrompt }]
    }),
    TIMEOUT_MS,
    "extraction"
  );

  const extractionRaw = extractionResponse.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  let extraction: ExtractionResult;
  try {
    extraction = JSON.parse(extractJsonFromResponse(extractionRaw)) as ExtractionResult;
  } catch {
    // Non-fatal: proceed with empty extraction so the patch plan call still runs
    extraction = {
      parties: [],
      directors: [],
      keyDates: [],
      keyAmounts: [],
      staleCandidates: [],
      detectedPlaceholders: input.placeholderList ?? [],
      optionBlocks: []
    };
  }

  // -------------------------------------------------------------------------
  // Step 2: Patch plan generation
  // -------------------------------------------------------------------------
  const patchPlanPrompt = buildPatchPlanPrompt(input, extraction);

  const patchPlanResponse = await callWithTimeout(
    client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4_000,
      temperature: 0,
      system: PATCH_PLAN_SYSTEM,
      messages: [{ role: "user", content: patchPlanPrompt }]
    }),
    TIMEOUT_MS,
    "patch-plan"
  );

  const patchPlanRaw = patchPlanResponse.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonFromResponse(patchPlanRaw));
  } catch (err) {
    throw new Error(`Patch plan response was not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Inject server-authoritative fields so the LLM cannot spoof them
  if (parsed && typeof parsed === "object") {
    (parsed as Record<string, unknown>).llm_model = DEFAULT_MODEL;
    (parsed as Record<string, unknown>).created_at = now;
  }

  if (!validatePatchPlan(parsed)) {
    throw new Error("Patch plan did not conform to expected schema.");
  }

  const modelTrace = {
    extractionTokens: {
      input: extractionResponse.usage.input_tokens,
      output: extractionResponse.usage.output_tokens
    },
    patchPlanTokens: {
      input: patchPlanResponse.usage.input_tokens,
      output: patchPlanResponse.usage.output_tokens
    }
  };

  return { patchPlan: parsed, modelTrace };
}

/**
 * Fallback used when ANTHROPIC_API_KEY is absent (dev / test without real key).
 * Returns a valid but empty patch plan with all fields unresolved.
 */
export function buildFallbackPatchPlan(input: {
  placeholderList?: string[];
  metadata: { jobId: string };
}): PatchPlan {
  const unresolved = (input.placeholderList ?? []).map((p) => ({
    field: p,
    question: `No API key — could not resolve ${p}`,
    locationHint: undefined
  }));

  return {
    llm_model: "fallback",
    created_at: new Date().toISOString(),
    replacements: [],
    placeholder_fills: [],
    insertions: [],
    deletions: [],
    signing_block_updates: [],
    unresolved
  };
}
