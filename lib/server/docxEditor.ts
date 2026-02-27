import mammoth from "mammoth";
import type { EditPlan } from "./editPlanGeneration.ts";

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyReplace(html: string, anchor: string, value: string): string {
  const pattern = new RegExp(escapeRegex(anchor), "g");
  return html.replace(pattern, escapeHtml(value));
}

function applyInsertAfter(html: string, anchor: string, value: string): string {
  // Match the first <p>…</p> block that contains the anchor text and append a new paragraph after it.
  const escapedAnchor = escapeRegex(anchor);
  // Allow any inline tags between the opening <p> and the anchor text.
  const pattern = new RegExp(`(<p(?:\\s[^>]*)?>(?:[^<]|<[^/][^>]*>)*?${escapedAnchor}.*?<\\/p>)`, "is");
  const newPara = `<p>${escapeHtml(value)}</p>`;
  const modified = html.replace(pattern, `$1${newPara}`);
  // If the pattern did not match (anchor not found), return html unchanged (safe no-op).
  return modified;
}

/**
 * Apply an edit plan to a DOCX buffer.
 * Strategy: mammoth → HTML → apply operations → html-to-docx → new DOCX buffer.
 */
export async function applyEditPlanToDocx(docxBuffer: Buffer, plan: EditPlan): Promise<Buffer> {
  // 1. Extract HTML from the precedent DOCX
  const conversionResult = await mammoth.convertToHtml({ buffer: docxBuffer });
  let html = conversionResult.value;

  // 2. Apply each operation in order
  for (const op of plan.operations) {
    if (op.type === "replace") {
      html = applyReplace(html, op.anchor, op.value);
    } else if (op.type === "insert_after") {
      html = applyInsertAfter(html, op.anchor, op.value);
    }
  }

  // 3. Convert modified HTML back to DOCX
  const htmlToDocx = (await import("html-to-docx")).default;
  const result = await htmlToDocx(html, null, {
    table: { row: { cantSplit: true } },
    footer: false,
    pageNumber: false
  });

  // html-to-docx returns Buffer in Node.js, but the type is declared broadly.
  if (Buffer.isBuffer(result)) {
    return result;
  }
  if (result instanceof ArrayBuffer) {
    return Buffer.from(result);
  }
  // Blob path (shouldn't occur in Node.js)
  const blob = result as Blob;
  return Buffer.from(await blob.arrayBuffer());
}
