import assert from "node:assert/strict";
import test from "node:test";
import {
  MATTER_PRECEDENT_UPLOAD_RULE,
  TEMPLATE_UPLOAD_RULE,
  TERM_SHEET_UPLOAD_RULE,
  TRANSACTION_UPLOAD_RULE,
  validateUploadField
} from "../lib/server/uploadGuards.ts";

function makeFile(name: string, type: string, bytes: number): File {
  return new File([Buffer.alloc(bytes)], name, { type });
}

test("template upload guard rejects invalid file type with 400", () => {
  const form = new FormData();
  form.append("templateFile", makeFile("template.exe", "application/octet-stream", 10));

  const result = validateUploadField(form, TEMPLATE_UPLOAD_RULE);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.equal(result.code, "invalid_type");
  }
});

test("template upload guard rejects oversized file with 413", () => {
  const form = new FormData();
  form.append("templateFile", makeFile("template.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 21 * 1024 * 1024));

  const result = validateUploadField(form, TEMPLATE_UPLOAD_RULE);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 413);
    assert.equal(result.code, "too_large");
  }
});

test("draft upload guard enforces transaction file count", () => {
  const form = new FormData();
  for (let index = 0; index < 11; index += 1) {
    form.append("transactionFiles", makeFile(`tx-${index}.pdf`, "application/pdf", 1024));
  }

  const result = validateUploadField(form, TRANSACTION_UPLOAD_RULE);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.equal(result.code, "invalid_count");
  }
});

test("term sheet upload guard allows optional empty field", () => {
  const form = new FormData();
  const result = validateUploadField(form, TERM_SHEET_UPLOAD_RULE);
  assert.equal(result.ok, true);
});

test("matter precedent upload guard accepts valid DOCX", () => {
  const form = new FormData();
  form.append("file", makeFile("precedent.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 4096));

  const result = validateUploadField(form, MATTER_PRECEDENT_UPLOAD_RULE);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.files.length, 1);
  }
});
