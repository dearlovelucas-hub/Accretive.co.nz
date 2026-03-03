type DiffChunk = {
  type: "equal" | "added" | "removed";
  line: string;
};

function normalizeLines(input: string): string[] {
  return input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\t/g, "  "));
}

// LCS-based line diff for deterministic comparison output.
function diffLines(baseText: string, nextText: string): DiffChunk[] {
  const base = normalizeLines(baseText);
  const next = normalizeLines(nextText);

  const m = base.length;
  const n = next.length;

  const table: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      if (base[i] === next[j]) {
        table[i][j] = table[i + 1][j + 1] + 1;
      } else {
        table[i][j] = Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }
  }

  const chunks: DiffChunk[] = [];
  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (base[i] === next[j]) {
      chunks.push({ type: "equal", line: base[i] });
      i += 1;
      j += 1;
      continue;
    }

    if (table[i + 1][j] >= table[i][j + 1]) {
      chunks.push({ type: "removed", line: base[i] });
      i += 1;
    } else {
      chunks.push({ type: "added", line: next[j] });
      j += 1;
    }
  }

  while (i < m) {
    chunks.push({ type: "removed", line: base[i] });
    i += 1;
  }
  while (j < n) {
    chunks.push({ type: "added", line: next[j] });
    j += 1;
  }

  return chunks;
}

function toAscii(input: string): string {
  return input.replace(/[^\x20-\x7E]/g, "?");
}

function wrapLine(line: string, maxChars = 95): string[] {
  if (line.length <= maxChars) {
    return [line];
  }

  const out: string[] = [];
  let cursor = 0;

  while (cursor < line.length) {
    out.push(line.slice(cursor, cursor + maxChars));
    cursor += maxChars;
  }

  return out;
}

function escapePdfText(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildContentStream(lines: Array<{ text: string; color: "default" | "added" | "removed" }>): string {
  const lineHeight = 14;
  const startY = 760;

  const out: string[] = [];
  out.push("BT");
  out.push("/F1 10 Tf");
  out.push(`${lineHeight} TL`);
  out.push(`40 ${startY} Td`);

  for (let i = 0; i < lines.length; i += 1) {
    const item = lines[i];

    if (item.color === "added") {
      out.push("0 0.45 0 rg");
    } else if (item.color === "removed") {
      out.push("0.8 0 0 rg");
    } else {
      out.push("0 0 0 rg");
    }

    out.push(`(${escapePdfText(toAscii(item.text))}) Tj`);
    if (i < lines.length - 1) {
      out.push("T*");
    }
  }

  out.push("ET");
  return out.join("\n");
}

function buildPdfFromPages(pageStreams: string[]): Buffer {
  const objects: string[] = [];
  const pageCount = pageStreams.length;
  const firstPageObjId = 3;
  const fontObjId = firstPageObjId + pageCount * 2;

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";

  const kids: string[] = [];
  for (let p = 0; p < pageCount; p += 1) {
    const pageObjId = firstPageObjId + p * 2;
    const contentObjId = pageObjId + 1;
    kids.push(`${pageObjId} 0 R`);

    objects[pageObjId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
      `/Resources << /Font << /F1 ${fontObjId} 0 R >> >> /Contents ${contentObjId} 0 R >>`;

    const stream = pageStreams[p];
    objects[contentObjId] = `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`;
  }

  objects[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pageCount} >>`;
  objects[fontObjId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  for (let id = 1; id < objects.length; id += 1) {
    if (!objects[id]) {
      continue;
    }
    offsets[id] = Buffer.byteLength(pdf, "utf8");
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let id = 1; id < objects.length; id += 1) {
    const offset = offsets[id] ?? 0;
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

export function buildComparisonPdf(args: {
  templateText: string;
  generatedText: string;
  title?: string;
  templateName?: string;
}): Buffer {
  const now = new Date().toISOString();
  const diff = diffLines(args.templateText, args.generatedText);

  const lines: Array<{ text: string; color: "default" | "added" | "removed" }> = [];
  lines.push({ text: args.title ?? "Accretive Comparison Report", color: "default" });
  lines.push({ text: `Generated at: ${now}`, color: "default" });
  if (args.templateName) {
    lines.push({ text: `Template: ${args.templateName}`, color: "default" });
  }
  lines.push({ text: "Legend: + added, - removed, unchanged lines unmarked", color: "default" });
  lines.push({ text: "", color: "default" });

  for (const row of diff) {
    const prefix = row.type === "added" ? "+ " : row.type === "removed" ? "- " : "  ";
    const wrapped = wrapLine(`${prefix}${row.line}`);
    for (const line of wrapped) {
      lines.push({
        text: line,
        color: row.type === "added" ? "added" : row.type === "removed" ? "removed" : "default"
      });
    }
  }

  const linesPerPage = 48;
  const pages: string[] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(buildContentStream(lines.slice(i, i + linesPerPage)));
  }

  if (pages.length === 0) {
    pages.push(buildContentStream([{ text: "No content.", color: "default" }]));
  }

  return buildPdfFromPages(pages);
}
