import JSZip from "jszip";
import mammoth from "mammoth";

const PLACEHOLDER_PATTERN = /(\{\{[^}]{1,120}\}\}|\[[^\]]{1,120}\]|<[^>]{1,120}>)/g;
const PLACEHOLDER_TEST_PATTERN = /(\{\{[^}]{1,120}\}\}|\[[^\]]{1,120}\]|<[^>]{1,120}>)/;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLines(value: string): string[] {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function inferPlaceholderValues(templateText: string, generatedText: string): Map<string, string> {
  const templateLines = normalizeLines(templateText);
  const generatedLines = normalizeLines(generatedText);

  const map = new Map<string, string>();
  const length = Math.min(templateLines.length, generatedLines.length);

  for (let i = 0; i < length; i += 1) {
    const templateLine = templateLines[i];
    const generatedLine = generatedLines[i];

    const placeholders = templateLine.match(PLACEHOLDER_PATTERN);
    if (!placeholders || placeholders.length === 0) {
      continue;
    }

    let cursor = 0;
    let regexSource = "^";

    for (const placeholder of placeholders) {
      const index = templateLine.indexOf(placeholder, cursor);
      if (index < 0) {
        continue;
      }

      const literal = templateLine.slice(cursor, index);
      regexSource += escapeRegex(literal);
      regexSource += "([\\s\\S]*?)";
      cursor = index + placeholder.length;
    }

    regexSource += escapeRegex(templateLine.slice(cursor));
    regexSource += "$";

    const match = new RegExp(regexSource).exec(generatedLine);
    if (!match) {
      continue;
    }

    placeholders.forEach((placeholder, idx) => {
      const value = (match[idx + 1] ?? "").trim();
      if (!value) {
        return;
      }
      if (PLACEHOLDER_TEST_PATTERN.test(value)) {
        return;
      }
      if (!map.has(placeholder)) {
        map.set(placeholder, value);
      }
    });
  }

  return map;
}

function applyMapToXml(xml: string, replacements: Map<string, string>): string {
  let next = xml;
  for (const [placeholder, value] of replacements.entries()) {
    next = next.replaceAll(placeholder, value);
  }
  return next;
}

export async function buildDocxFromTemplateWithPreservedFormatting(args: {
  templateBuffer: Buffer;
  generatedOutput: string;
}): Promise<Buffer> {
  const templateText = (await mammoth.extractRawText({ buffer: args.templateBuffer })).value;
  const replacements = inferPlaceholderValues(templateText, args.generatedOutput);

  const zip = await JSZip.loadAsync(args.templateBuffer);
  const candidateFiles = Object.keys(zip.files).filter((name) => /^word\/(document|header\d+|footer\d+)\.xml$/i.test(name));

  if (candidateFiles.length === 0) {
    return args.templateBuffer;
  }

  if (replacements.size === 0) {
    return args.templateBuffer;
  }

  for (const fileName of candidateFiles) {
    const entry = zip.file(fileName);
    if (!entry) {
      continue;
    }

    const xml = await entry.async("string");
    const patched = applyMapToXml(xml, replacements);
    zip.file(fileName, patched);
  }

  return zip.generateAsync({ type: "nodebuffer" });
}
