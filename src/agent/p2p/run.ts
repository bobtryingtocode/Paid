import { z } from "zod";
import { CanonicalInvoiceSchema, type CanonicalInvoice } from "@/agent/invoice/schema";
import { extractInvoiceFromPdf, extractInvoiceFromText } from "@/agent/invoice/extract";
import { runProcureToPayAgent } from "@/agent/p2p/agent";
import { UsageMeter } from "@/billing/usage";
import { checkCapacity, recordUsage } from "@/billing/entitlements";

/**
 * One metered agent run, shared by the sync API route and the Netlify
 * background function. Gates on the merchant's capacity (hard block), runs
 * extraction + the agent loop, and records real token usage even on failure.
 */
export const AgentJobInputSchema = z
  .object({
    pdfBase64: z.string().optional(),
    text: z.string().optional(),
    invoice: CanonicalInvoiceSchema.optional(),
  })
  .refine((b) => b.pdfBase64 || b.text || b.invoice, {
    message: "Provide one of: pdfBase64, text, or invoice",
  });

export type AgentJobInput = z.infer<typeof AgentJobInputSchema>;

export class QuotaError extends Error {}

export interface AgentRunOutput {
  invoice: CanonicalInvoice;
  summary: string;
  context: unknown;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    remainingTokens: number;
  };
}

export async function executeAgentRun(
  merchantId: string,
  input: AgentJobInput,
): Promise<AgentRunOutput> {
  const capacity = await checkCapacity(merchantId);
  if (!capacity.allowed || !capacity.usagePeriodId) {
    throw new QuotaError(capacity.reason ?? "No capacity");
  }

  const meter = new UsageMeter();
  try {
    const normalized = input.invoice
      ? input.invoice
      : input.pdfBase64
        ? await extractInvoiceFromPdf(input.pdfBase64, meter)
        : await extractInvoiceFromText(input.text!, meter);

    const result = await runProcureToPayAgent(normalized, meter);

    return {
      invoice: normalized,
      summary: result.summary,
      context: result.context,
      usage: {
        inputTokens: meter.inputTokens,
        outputTokens: meter.outputTokens,
        totalTokens: meter.totalTokens,
        remainingTokens: Math.max(0, capacity.remainingTokens - meter.totalTokens),
      },
    };
  } finally {
    if (meter.totalTokens > 0) {
      await recordUsage(capacity.usagePeriodId, meter.inputTokens, meter.outputTokens);
    }
  }
}
