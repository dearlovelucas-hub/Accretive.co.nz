function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function textToHtmlParagraphs(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n");
  const blocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  if (!blocks.length) {
    return "<p></p>";
  }

  return blocks
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

export async function buildDocxFromDraftText(text: string): Promise<Buffer> {
  const htmlToDocx = (await import("html-to-docx")).default;
  const html = `<!doctype html><html><body>${textToHtmlParagraphs(text)}</body></html>`;

  const result = await htmlToDocx(html, null, {
    table: { row: { cantSplit: true } },
    footer: false,
    pageNumber: false
  });

  if (Buffer.isBuffer(result)) {
    return result;
  }
  if (result instanceof ArrayBuffer) {
    return Buffer.from(result);
  }

  const blob = result as Blob;
  return Buffer.from(await blob.arrayBuffer());
}
