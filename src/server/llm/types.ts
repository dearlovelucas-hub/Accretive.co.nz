// ---------------------------------------------------------------------------
// PatchPlan types — the strict, auditable diff format produced by the LLM
// and applied to a DOCX template as tracked changes.
// ---------------------------------------------------------------------------

export type EvidenceRef = {
  /** Zero-based index into the transactionTexts array supplied to the wrapper */
  docIndex: number;
  /** ID of the source document */
  docId: string;
  /** Short verbatim excerpt (≤ 200 chars) that supports the proposed change */
  excerpt: string;
};

// ---------------------------------------------------------------------------
// Individual operation types
// ---------------------------------------------------------------------------

export type ReplaceExactOp = {
  type: "replace_exact";
  /** Verbatim string that MUST appear exactly once in the template */
  target: string;
  /** Verbatim replacement string */
  replacement: string;
  reason: string;
  evidenceRefs: EvidenceRef[];
  /** 0..1 confidence score; operations with < 0.7 are skipped */
  confidence: number;
  requires_exact_match: true;
};

export type FillPlaceholderOp = {
  type: "fill_placeholder";
  /** Placeholder token exactly as it appears in the template (e.g. "{{BORROWER}}") */
  placeholder: string;
  /** Value to substitute */
  value: string;
  reason: string;
  evidenceRefs: EvidenceRef[];
  confidence: number;
  requires_exact_match: true;
};

export type InsertionOp = {
  type: "insert_before" | "insert_after";
  /** Exact anchor string in the template; content is inserted adjacent to it */
  anchor: string;
  /**
   * Content to insert. Must replace a placeholder marker or fill a clearly
   * variable segment — never introduces substantive new clause text.
   */
  content: string;
  reason: string;
  evidenceRefs: EvidenceRef[];
  confidence: number;
  requires_exact_match: true;
};

export type DeleteRangeOp = {
  type: "delete_range";
  /** Start of the range to delete (must be unique in document) */
  anchor_start: string;
  /** End of the range to delete (must be unique in document) */
  anchor_end: string;
  reason: string;
  evidenceRefs: EvidenceRef[];
  /** Minimum 0.85 required for deletions to be applied */
  confidence: number;
  safety: {
    requires_exact_match: true;
    min_chars: number;
    max_chars: number;
  };
};

export type SigningBlockUpdateOp = {
  type: "signing_block_update";
  /** Location hint to find the signing block (e.g. "EXECUTION", "SIGNED for and on behalf") */
  locationHint: string;
  directorCount: number;
  directorNames?: string[];
  reason: string;
  evidenceRefs: EvidenceRef[];
  confidence: number;
};

export type UnresolvedField = {
  field: string;
  question: string;
  locationHint?: string;
};

// ---------------------------------------------------------------------------
// Top-level PatchPlan
// ---------------------------------------------------------------------------

export type PatchPlan = {
  llm_model: string;
  created_at: string; // ISO 8601
  replacements: ReplaceExactOp[];
  placeholder_fills: FillPlaceholderOp[];
  insertions: InsertionOp[];
  deletions: DeleteRangeOp[];
  signing_block_updates: SigningBlockUpdateOp[];
  unresolved: UnresolvedField[];
};

// ---------------------------------------------------------------------------
// Helpers for validation
// ---------------------------------------------------------------------------

/** Minimum confidence required to apply a deletion */
export const MIN_DELETION_CONFIDENCE = 0.85;
/** Minimum confidence required to apply any other operation */
export const MIN_OP_CONFIDENCE = 0.7;
/** Default maximum characters a single delete_range may span */
export const DEFAULT_MAX_DELETE_CHARS = 5000;

/** Validates that a PatchPlan object has the required shape (does not call LLM) */
export function validatePatchPlan(plan: unknown): plan is PatchPlan {
  if (!plan || typeof plan !== "object") {
    return false;
  }

  const p = plan as Record<string, unknown>;

  return (
    typeof p.llm_model === "string" &&
    typeof p.created_at === "string" &&
    Array.isArray(p.replacements) &&
    Array.isArray(p.placeholder_fills) &&
    Array.isArray(p.insertions) &&
    Array.isArray(p.deletions) &&
    Array.isArray(p.signing_block_updates) &&
    Array.isArray(p.unresolved)
  );
}
