# LLM Wrapper — Tracked-Changes Document Drafting

## Overview

The LLM wrapper generates a **PatchPlan** — a strict, auditable JSON diff — and applies it to a DOCX template to produce a new DOCX with Microsoft Word **tracked changes** (`<w:ins>` / `<w:del>`).

This approach is fundamentally different from the original `generateDraftWithLlm` flow: instead of free-form text generation, the LLM proposes only bounded, evidence-backed edits to the existing template.

---

## How Patch Plans Work

A **PatchPlan** is a deterministic JSON document describing exactly what changes to make to a template. It has six operation arrays:

| Field | Description |
|---|---|
| `replacements` | Replace an exact verbatim string with another (e.g., stale entity name → correct party name) |
| `placeholder_fills` | Fill a detected placeholder token (`{{FIELD}}`, `[FIELD]`, `<FIELD>`) with a value from transaction docs |
| `insertions` | Insert content immediately before or after an exact anchor string |
| `deletions` | Delete a range between two exact anchor strings (for mutually-exclusive option blocks) |
| `signing_block_updates` | Update director count/names in signing blocks |
| `unresolved` | Fields/questions that could not be resolved (no edit applied) |

### Strict rules enforced by the prompts and code

1. **No new clauses** — the LLM may not invent new legal language.
2. **No rewriting** — template text is kept verbatim except for permitted edits.
3. **Exact match required** — every `target`, `placeholder`, `anchor`, `anchor_start`, `anchor_end` must be a verbatim substring of the template. If not found uniquely, the operation is skipped.
4. **Evidence required** — every operation includes `evidenceRefs` pointing back to source documents.
5. **Deletions need confidence ≥ 0.85** — and must stay within `max_chars` bounds (default 5 000).
6. **If uncertain → unresolved** — ambiguous cases produce `unresolved` entries rather than guesses.

---

## Two-Step Prompting Pattern

### Step 1 — Extraction call

Extracts structured facts from transaction documents and the template:

- Party names and roles (borrower, lender, vendor, purchaser…)
- Director names
- Key dates and amounts
- Stale entity name candidates (old name in template → new name from tx docs)
- Detected placeholder tokens
- Mutually-exclusive option blocks with delete candidates

Returns flexible JSON (an `ExtractionResult`). Non-fatal if the model returns invalid JSON — falls back to empty extraction so the patch plan call still proceeds.

### Step 2 — Patch plan call

Generates the strict `PatchPlan` JSON from:
- The extraction result
- The full template text
- All transaction document text
- Other info (deal context)

The system prompt enforces the hard rules above. The model must return **only JSON** conforming to the PatchPlan schema.

Both calls use `temperature: 0` for determinism.

---

## How Tracked Changes Are Represented

Tracked changes use the [OOXML WordprocessingML revision elements](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.revision):

### Deletion (old text struck through in Word)
```xml
<w:del w:id="1" w:author="Accretive" w:date="2025-01-01T00:00:00.000Z">
  <w:r>
    <w:rPr>...</w:rPr>
    <w:delText xml:space="preserve">OLD TEXT</w:delText>
  </w:r>
</w:del>
```

### Insertion (new text underlined in Word)
```xml
<w:ins w:id="2" w:author="Accretive" w:date="2025-01-01T00:00:00.000Z">
  <w:r>
    <w:rPr>...</w:rPr>
    <w:t xml:space="preserve">NEW TEXT</w:t>
  </w:r>
</w:ins>
```

Replacements = `<w:del>` + `<w:ins>` in sequence.

The `w:id` attribute is unique across the entire document. The author is always `"Accretive"`. Run properties (`<w:rPr>`) are copied from the surrounding runs to preserve formatting.

---

## Concurrency Leasing Model

Multiple org members can use the product simultaneously. Safe concurrency is achieved via **Postgres lease fields** on the `jobs` table.

### Lease columns (migration 0006)

| Column | Type | Purpose |
|---|---|---|
| `leased_at` | `TIMESTAMPTZ` | When the lease was claimed |
| `lease_owner` | `TEXT` | Unique ID of the server instance that claimed it |
| `lease_expires_at` | `TIMESTAMPTZ` | When the lease expires (now + LLM timeout + 30s buffer) |
| `attempts` | `INT` | How many times this job has been attempted |
| `last_error_code` | `TEXT` | Machine-readable error code of the last failure |
| `last_error_message` | `TEXT` | Human-readable error message of the last failure |

### State machine

```
queued → processing (lease claimed) → complete
                                    → failed
```

A job in `processing` with an expired lease can be re-claimed by any server instance ("stuck job recovery").

### Concurrency caps

Enforced before claiming a lease:

| Config | Env var | Default |
|---|---|---|
| Per-org concurrent jobs | `LLM_MAX_CONCURRENCY_PER_ORG` | 3 |
| Global concurrent jobs | `LLM_MAX_CONCURRENCY_GLOBAL` | 20 |
| Max retry attempts | `LLM_MAX_ATTEMPTS` | 3 |
| LLM call timeout | `LLM_TIMEOUT_MS` | 60 000 ms |

If a cap is exceeded, `/api/drafts/:jobId/llm-run` returns `429` with a `Retry-After` header.

### Idempotency

If a job is already `complete` with a stored `patch_plan` and `output_docx_tracked`, `/llm-run` returns the existing output immediately without re-running the LLM.

---

## Safety Rules in Code

The patcher (`docxTrackedChangesPatcher.ts`) enforces:

- **Exact uniqueness**: any target/anchor that appears 0 or ≥ 2 times in the document → operation skipped → added to unresolved.
- **Deletion bounds**: `anchor_start` and `anchor_end` each must appear exactly once; deleted range must be within `[min_chars, max_chars]`.
- **No structural boundary crossing**: if a delete range spans a table, paragraph boundary, section properties, or numbering element → skipped to unresolved.
- **Confidence gates**: replacements/fills/insertions require `confidence ≥ 0.7`; deletions require `confidence ≥ 0.85`.
- **No content logging**: only job IDs, file sizes, and timing are logged. Document content is never logged.

---

## API Endpoints

### `POST /api/drafts/:jobId/llm-run`
Triggers patch plan generation and DOCX patching. Claims a lease, calls the two-step Anthropic chain, applies tracked changes, persists output, and releases the lease.

Returns `{ jobId, status, patchPlan, unresolved, unresolvedCount }`.

### `GET /api/drafts/:jobId/patch-plan`
Returns the stored patch plan and unresolved fields.

Returns `{ jobId, status, patchPlan, unresolved, llmModel }`.

### `POST /api/drafts/:jobId/resolve`
Accepts user answers for unresolved fields, re-applies the patch plan (with the answers as additional `placeholder_fills`) without calling the model.

Body: `{ "answers": { "{{FIELD}}": "value", ... } }`

Returns `{ resolvedCount, remainingUnresolved, unresolvedCount }`.

### `GET /api/drafts/:jobId/download?variant=tracked`
Downloads the tracked-changes DOCX. Admins can access org-wide; members only their own.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes (for real drafts) | — | Anthropic API key |
| `ANTHROPIC_MODEL` | No | `claude-3-5-sonnet-latest` | Model to use for both calls |
| `LLM_TIMEOUT_MS` | No | `60000` | Per-call timeout in milliseconds |
| `LLM_MAX_CONCURRENCY_PER_ORG` | No | `3` | Max concurrent LLM jobs per org |
| `LLM_MAX_CONCURRENCY_GLOBAL` | No | `20` | Max concurrent LLM jobs globally |
| `LLM_MAX_ATTEMPTS` | No | `3` | Max retry attempts before permanent failure |

If `ANTHROPIC_API_KEY` is absent, a fallback patch plan is used (all fields unresolved, no changes applied). This is safe for local dev/testing.

---

## Key Files

| File | Purpose |
|---|---|
| `src/server/llm/types.ts` | PatchPlan TypeScript types and validation |
| `src/server/llm/anthropicWrapper.ts` | Two-step Anthropic chain |
| `src/server/llm/leasing.ts` | Lease claim/release and concurrency cap logic |
| `src/server/docx/docxTrackedChangesPatcher.ts` | DOCX XML manipulation with tracked changes |
| `app/api/drafts/[jobId]/llm-run/route.ts` | POST route — full pipeline |
| `app/api/drafts/[jobId]/patch-plan/route.ts` | GET route — view patch plan |
| `app/api/drafts/[jobId]/resolve/route.ts` | POST route — resolve unresolved fields |
| `app/api/drafts/[jobId]/download/route.ts` | GET route — download tracked DOCX |
| `db/migrations/0006_llm_leasing.sql` | DB migration for lease fields and draft output storage |
