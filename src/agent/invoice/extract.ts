import type Anthropic from "@anthropic-ai/sdk";
import { AGENT_MODEL, createMessage } from "@/agent/anthropic";
import type { UsageMeter } from "@/billing/usage";
import {
  CanonicalInvoiceSchema,
  EMIT_INVOICE_INPUT_SCHEMA,
  type CanonicalInvoice,
} from "./schema";

const EXTRACTION_SYSTEM = `You extract structured data from project-cost invoices.
Read the document and call the emit_invoice tool exactly once with the invoice's
fields. Convert every monetary amount to integer cents (e.g. $1,250.00 -> 125000).
Use ISO YYYY-MM-DD for dates. If a field is genuinely absent, omit it rather than
guessing. Ensure lineItems amounts and the subtotal/tax/total are internally
consistent.`;

const EMIT_INVOICE_TOOL: Anthropic.Tool = {
  name: "emit_invoice",
  description: "Return the structured, normalized invoice data.",
  input_schema: EMIT_INVOICE_INPUT_SCHEMA,
};

/**
 * Run the extraction model over a document content block and validate the
 * forced tool call against the canonical schema.
 */
async function extract(
  documentBlock: Anthropic.ContentBlockParam,
  meter?: UsageMeter,
): Promise<CanonicalInvoice> {
  const message = await createMessage({
    model: AGENT_MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: EXTRACTION_SYSTEM,
    tools: [EMIT_INVOICE_TOOL],
    tool_choice: { type: "tool", name: "emit_invoice" },
    messages: [
      {
        role: "user",
        content: [
          documentBlock,
          { type: "text", text: "Extract this invoice." },
        ],
      },
    ],
  });
  meter?.addFromMessage(message);

  const toolUse = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) {
    throw new Error("Extraction did not return an emit_invoice tool call");
  }
  return CanonicalInvoiceSchema.parse(toolUse.input);
}

/** Extract a canonical invoice from a base64-encoded PDF. */
export function extractInvoiceFromPdf(
  pdfBase64: string,
  meter?: UsageMeter,
): Promise<CanonicalInvoice> {
  return extract(
    {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
    },
    meter,
  );
}

/** Extract a canonical invoice from plain-text invoice content. */
export function extractInvoiceFromText(
  text: string,
  meter?: UsageMeter,
): Promise<CanonicalInvoice> {
  return extract(
    {
      type: "document",
      source: { type: "text", media_type: "text/plain", data: text },
    },
    meter,
  );
}
