import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { DealContext } from "./termSheetExtraction.ts";

export const EditOperationSchema = z.object({
  type: z.enum(["replace", "insert_after"]),
  anchor: z.string().min(1),
  value: z.string()
});

export const EditPlanSchema = z.object({
  operations: z.array(EditOperationSchema).max(50)
});

export type EditOperation = z.infer<typeof EditOperationSchema>;
export type EditPlan = z.infer<typeof EditPlanSchema>;

const DEFAULT_MODEL = process.env.CLAUDE_MODEL ?? "claude-3-5-sonnet-latest";
const TOOL_NAME = "generate_edit_plan";

const EDIT_PLAN_JSON_SCHEMA = {
  type: "object" as const,
  required: ["operations"],
  properties: {
    operations: {
      type: "array",
      maxItems: 50,
      description: "Ordered list of edit operations to apply to the precedent document",
      items: {
        type: "object",
        required: ["type", "anchor", "value"],
        properties: {
          type: {
            type: "string",
            enum: ["replace", "insert_after"],
            description:
              "'replace': substitute every occurrence of anchor text with value. " +
              "'insert_after': add value as a new paragraph immediately after the paragraph containing anchor."
          },
          anchor: {
            type: "string",
            description:
              "Exact verbatim text that appears in the precedent document. Must be unique enough to identify the target location unambiguously."
          },
          value: {
            type: "string",
            description: "The new text to insert or the replacement text."
          }
        }
      }
    }
  }
};

function buildPrompt(precedentText: string, dealContext: DealContext): string {
  return [
    "You are a legal drafting assistant. Given the following precedent document and deal context, " +
      "produce the MINIMAL set of edit operations required to populate the precedent with deal-specific information.",
    "",
    "Strict rules:",
    "- Only produce operations where the deal context provides a concrete value to fill in.",
    "- Do NOT add, remove, or restructure headings, recitals, or clauses.",
    "- Do NOT add any front-matter, preamble, or commentary.",
    "- Preserve all existing clause ordering and numbering.",
    "- 'anchor' must be verbatim text that already exists in the precedent.",
    "- If information is not available in the deal context, do not create an operation for that field.",
    "- Keep the total number of operations to the minimum necessary (max 50).",
    "",
    "PRECEDENT DOCUMENT:",
    "---",
    precedentText.slice(0, 20000),
    "---",
    "",
    "DEAL CONTEXT (JSON):",
    "---",
    JSON.stringify(dealContext, null, 2),
    "---"
  ].join("\n");
}

function buildFallbackPlan(): EditPlan {
  return { operations: [] };
}

export async function generateEditPlan(precedentText: string, dealContext: DealContext): Promise<EditPlan> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return buildFallbackPlan();
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const prompt = buildPrompt(precedentText, dealContext);

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 2048,
      system:
        "You are a precise legal document editor. You produce structured edit plans that modify precedent documents minimally. " +
        "You never invent facts and never restructure documents.",
      tools: [
        {
          name: TOOL_NAME,
          description: "Generate a minimal edit plan for the precedent document based on deal context",
          input_schema: EDIT_PLAN_JSON_SCHEMA
        }
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [{ role: "user", content: prompt }]
    });
  } catch {
    return buildFallbackPlan();
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === TOOL_NAME
  );

  if (!toolUse) {
    return buildFallbackPlan();
  }

  const parsed = EditPlanSchema.safeParse(toolUse.input);
  return parsed.success ? parsed.data : buildFallbackPlan();
}
