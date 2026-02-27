import Anthropic from "@anthropic-ai/sdk";
import * as crypto from "node:crypto";
import type { DraftTraceStep } from "@/lib/server/draftJobsStore";

type PromptDoc = {
  name: string;
  type: string;
  size: number;
  extractionNote: string;
  textExcerpt?: string;
};

export type DraftPipelineInput = {
  template: PromptDoc;
  templateFieldHints?: string[];
  transactionDocuments: PromptDoc[];
  termSheet?: PromptDoc;
  dealInfo: string;
};

const DEFAULT_MODEL = process.env.CLAUDE_MODEL || "claude-3-5-sonnet-latest";
const PROMPT_VERSION = "v1.0.0";

function buildPrompt(input: DraftPipelineInput): string {
  const todayIsoDate = new Date().toISOString().slice(0, 10);

  return [
    "You are an experienced legal drafting assistant for transactional law firms.",
    "Primary objective: produce a FIRST DRAFT by filling the PROVIDED TEMPLATE using facts from transaction documents and term sheet.",
    "Do NOT create a brand-new generic document if a template is provided.",
    "",
    "Critical drafting rules:",
    "- Treat the template as the source-of-truth structure.",
    "- Preserve clause ordering/headings/format as much as possible.",
    "- Replace placeholders where evidence exists in transaction docs/term sheet/deal info.",
    "- Placeholder patterns may look like {{FIELD}}, [FIELD], <FIELD>, or ALL-CAPS bracket fields.",
    "- If information is missing, keep placeholder token OR use [[MISSING: field_name]].",
    "- Do not invent parties, values, dates, percentages, or legal elections.",
    "- Use New Zealand legal drafting tone if jurisdiction is NZ; otherwise neutral common-law tone.",
    `- Always assume today's date (${todayIsoDate}) is the date of the resolution unless source documents explicitly specify a different resolution date.`,
    "- Output ONLY the generated template text.",
    "- Do NOT include context summaries, headings, JSON, markdown sections, explanations, or any surrounding commentary.",
    "- Do NOT include text before or after the generated template.",
    "",
    `Template file: ${input.template.name} (${input.template.type}, ${input.template.size} bytes)`,
    `Template extraction note: ${input.template.extractionNote}`,
    input.template.textExcerpt ? `Template excerpt:\n${input.template.textExcerpt}` : "Template excerpt: unavailable",
    input.templateFieldHints?.length
      ? `Template field candidates:\n${input.templateFieldHints.map((field) => `- ${field}`).join("\n")}`
      : "Template field candidates: none detected from parser.",
    "",
    `Transaction documents count: ${input.transactionDocuments.length}`,
    ...input.transactionDocuments.flatMap((doc, index) => [
      `Transaction document ${index + 1}: ${doc.name} (${doc.type}, ${doc.size} bytes)`,
      `Extraction note: ${doc.extractionNote}`,
      doc.textExcerpt ? `Excerpt:\n${doc.textExcerpt}` : "Excerpt: unavailable",
      ""
    ]),
    input.termSheet
      ? `Term sheet: ${input.termSheet.name} (${input.termSheet.type}, ${input.termSheet.size} bytes)\nExtraction note: ${input.termSheet.extractionNote}\n${
          input.termSheet.textExcerpt ? `Excerpt:\n${input.termSheet.textExcerpt}` : "Excerpt: unavailable"
        }`
      : "Term sheet: none provided",
    "",
    `Additional deal information:\n${input.dealInfo}`
  ].join("\n");
}

function normalizeTemplateOnlyOutput(raw: string): string {
  const draftSectionMatch = raw.match(/##\s*Draft Document[\s\r\n]*([\s\S]*)/i);
  if (draftSectionMatch?.[1]?.trim()) {
    return draftSectionMatch[1].trim();
  }

  return raw.trim();
}

function hashPrompt(prompt: string): string {
  return crypto.createHash("sha256").update(prompt).digest("hex");
}

function parseTraceSteps(markdown: string): DraftTraceStep[] {
  return [
    {
      id: "context_summary",
      label: "Context Summary",
      content: "Suppressed: output is constrained to template text only."
    },
    {
      id: "required_fields",
      label: "Required Template Fields Detected",
      content: "Suppressed: output is constrained to template text only."
    },
    {
      id: "missing_questions",
      label: "Missing Information Questions",
      content: "Suppressed: output is constrained to template text only."
    },
    {
      id: "final_draft",
      label: "Draft Document",
      content: markdown
    }
  ];
}

function buildFallbackDraft(input: DraftPipelineInput): string {
  return (input.template.textExcerpt ?? "").trim();
}

export async function generateDraftWithLlm(input: DraftPipelineInput): Promise<{
  output: string;
  model: string;
  promptVersion: string;
  promptHash: string;
  promptPreview: string;
  traceSteps: DraftTraceStep[];
}> {
  const prompt = buildPrompt(input);
  const promptHash = hashPrompt(prompt);
  const promptPreview = prompt.slice(0, 1200);

  if (!process.env.ANTHROPIC_API_KEY) {
    const output = normalizeTemplateOnlyOutput(buildFallbackDraft(input));
    return {
      output,
      model: "fallback",
      promptVersion: PROMPT_VERSION,
      promptHash,
      promptPreview,
      traceSteps: parseTraceSteps(output)
    };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const completion = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 2800,
    temperature: 0.2,
    system: "You draft transactional legal first drafts from templates and matter context.",
    messages: [
      {
        role: "user",
        content: prompt
      }
    ]
  });

  const content = completion.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!content) {
    throw new Error("LLM returned empty content.");
  }

  const normalizedOutput = normalizeTemplateOnlyOutput(content);

  return {
    output: normalizedOutput,
    model: DEFAULT_MODEL,
    promptVersion: PROMPT_VERSION,
    promptHash,
    promptPreview,
    traceSteps: parseTraceSteps(normalizedOutput)
  };
}
