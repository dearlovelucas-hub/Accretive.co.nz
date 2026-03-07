/**
 * Unit tests for PatchPlan validation and safety checks.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { validatePatchPlan, MIN_DELETION_CONFIDENCE, MIN_OP_CONFIDENCE, DEFAULT_MAX_DELETE_CHARS } from "../src/server/llm/types.ts";
import type { PatchPlan } from "../src/server/llm/types.ts";

const VALID_PLAN: PatchPlan = {
  llm_model: "claude-3-5-sonnet-latest",
  created_at: new Date().toISOString(),
  replacements: [],
  placeholder_fills: [],
  insertions: [],
  deletions: [],
  signing_block_updates: [],
  unresolved: []
};

test("validatePatchPlan accepts a valid empty plan", () => {
  assert.ok(validatePatchPlan(VALID_PLAN));
});

test("validatePatchPlan rejects null", () => {
  assert.ok(!validatePatchPlan(null));
});

test("validatePatchPlan rejects missing arrays", () => {
  const bad = { ...VALID_PLAN, replacements: undefined };
  assert.ok(!validatePatchPlan(bad));
});

test("validatePatchPlan rejects non-array replacements", () => {
  const bad = { ...VALID_PLAN, replacements: "not-an-array" };
  assert.ok(!validatePatchPlan(bad));
});

test("validatePatchPlan rejects missing llm_model", () => {
  const { llm_model: _, ...rest } = VALID_PLAN;
  assert.ok(!validatePatchPlan(rest));
});

test("MIN_DELETION_CONFIDENCE is 0.85", () => {
  assert.equal(MIN_DELETION_CONFIDENCE, 0.85);
});

test("MIN_OP_CONFIDENCE is 0.7", () => {
  assert.equal(MIN_OP_CONFIDENCE, 0.7);
});

test("DEFAULT_MAX_DELETE_CHARS is 5000", () => {
  assert.equal(DEFAULT_MAX_DELETE_CHARS, 5000);
});

test("validatePatchPlan accepts plan with populated operations", () => {
  const plan: PatchPlan = {
    ...VALID_PLAN,
    replacements: [
      {
        type: "replace_exact",
        target: "OLD NAME LTD",
        replacement: "NEW NAME LTD",
        reason: "Party name update",
        evidenceRefs: [{ docIndex: 0, docId: "doc1", excerpt: "NEW NAME LTD as borrower" }],
        confidence: 0.95,
        requires_exact_match: true
      }
    ],
    placeholder_fills: [
      {
        type: "fill_placeholder",
        placeholder: "{{LOAN_AMOUNT}}",
        value: "$500,000",
        reason: "Loan amount from term sheet",
        evidenceRefs: [{ docIndex: 0, docId: "doc1", excerpt: "loan of $500,000" }],
        confidence: 0.98,
        requires_exact_match: true
      }
    ],
    unresolved: [
      { field: "{{SETTLEMENT_DATE}}", question: "Settlement date not found in documents." }
    ]
  };
  assert.ok(validatePatchPlan(plan));
});
