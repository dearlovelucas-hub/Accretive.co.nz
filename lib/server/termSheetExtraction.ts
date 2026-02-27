import * as crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getRepos } from "../../src/server/repos/index.ts";

export const DealContextSchema = z.object({
  parties: z
    .array(
      z.object({
        role: z.string(),
        name: z.string(),
        jurisdiction: z.string().optional()
      })
    )
    .default([]),
  transactionType: z.string().optional(),
  purchasePrice: z.string().optional(),
  currency: z.string().optional(),
  closingDate: z.string().optional(),
  governingLaw: z.string().optional(),
  keyConditions: z.array(z.string()).default([]),
  representations: z.array(z.string()).default([]),
  otherTerms: z.record(z.string(), z.string()).default({})
});

export type DealContext = z.infer<typeof DealContextSchema>;

const DEFAULT_MODEL = process.env.CLAUDE_MODEL ?? "claude-3-5-sonnet-latest";
const TOOL_NAME = "extract_deal_context";

const DEAL_CONTEXT_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    parties: {
      type: "array",
      description: "All named parties to the transaction",
      items: {
        type: "object",
        properties: {
          role: { type: "string", description: "e.g. Vendor, Purchaser, Guarantor, Target Company" },
          name: { type: "string", description: "Legal name of the party" },
          jurisdiction: { type: "string", description: "Incorporation jurisdiction if stated" }
        },
        required: ["role", "name"]
      }
    },
    transactionType: {
      type: "string",
      description: "e.g. Share Sale, Asset Sale, Subscription, Merger, Joint Venture"
    },
    purchasePrice: { type: "string", description: "Consideration amount as stated in the term sheet" },
    currency: { type: "string", description: "Currency code e.g. NZD, USD, AUD" },
    closingDate: { type: "string", description: "Anticipated closing / settlement date if stated" },
    governingLaw: { type: "string", description: "Governing law jurisdiction" },
    keyConditions: {
      type: "array",
      items: { type: "string" },
      description: "Conditions precedent or key conditions to completion"
    },
    representations: {
      type: "array",
      items: { type: "string" },
      description: "Notable representations or warranties mentioned"
    },
    otherTerms: {
      type: "object",
      additionalProperties: { type: "string" },
      description: "Any other notable defined terms or deal-specific fields"
    }
  }
};

function buildFallbackContext(): DealContext {
  return DealContextSchema.parse({});
}

export async function extractContextFromTermSheet(text: string): Promise<DealContext> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return buildFallbackContext();
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      system:
        "You are a legal analyst. Extract structured deal information from the term sheet text. Only include information explicitly stated in the text — do not infer or hallucinate values.",
      tools: [
        {
          name: TOOL_NAME,
          description: "Extract structured deal context from the term sheet",
          input_schema: DEAL_CONTEXT_JSON_SCHEMA
        }
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [
        {
          role: "user",
          content: `Extract the deal context from this term sheet:\n\n${text.slice(0, 20000)}`
        }
      ]
    });
  } catch {
    return buildFallbackContext();
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === TOOL_NAME
  );

  if (!toolUse) {
    return buildFallbackContext();
  }

  const parsed = DealContextSchema.safeParse(toolUse.input);
  return parsed.success ? parsed.data : buildFallbackContext();
}

/**
 * Extract deal context from a term sheet, caching the result by uploadId.
 * If a valid cached extraction exists, it is returned without calling Claude again.
 */
export async function extractAndCacheContext(uploadId: string, uploadText: string): Promise<DealContext> {
  const repos = getRepos();

  const cached = await repos.extractionCache.getByUploadId(uploadId);
  if (cached?.extractedJson) {
    try {
      const parsed = DealContextSchema.safeParse(JSON.parse(cached.extractedJson));
      if (parsed.success) {
        return parsed.data;
      }
    } catch {
      // Cache entry is corrupt; fall through to re-extract
    }
  }

  const context = await extractContextFromTermSheet(uploadText);

  await repos.extractionCache.create({
    id: crypto.randomUUID(),
    uploadId,
    extractedText: uploadText.slice(0, 50000),
    extractedJson: JSON.stringify(context)
  });

  return context;
}
