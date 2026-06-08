import { z } from "zod";
import { ok, error } from "@/lib/http";
import { CanonicalInvoiceSchema } from "@/agent/invoice/schema";
import { extractInvoiceFromPdf, extractInvoiceFromText } from "@/agent/invoice/extract";
import { runProcureToPayAgent } from "@/agent/p2p/agent";
import { UsageMeter } from "@/billing/usage";
import { checkCapacity, recordUsage } from "@/billing/entitlements";

export const runtime = "nodejs";
// Agent runs can take a while (extraction + multi-turn tool loop).
export const maxDuration = 300;

const BodySchema = z
  .object({
    // TODO(auth): derive merchantId from the authenticated session.
    merchantId: z.string().min(1),
    pdfBase64: z.string().optional(),
    text: z.string().optional(),
    invoice: CanonicalInvoiceSchema.optional(),
  })
  .refine((b) => b.pdfBase64 || b.text || b.invoice, {
    message: "Provide one of: pdfBase64, text, or invoice",
  });

/**
 * POST /api/agent/p2p — the AI gateway for the procure-to-pay invoice agent.
 *
 * Accepts a PDF (base64), raw invoice text, or an already-normalized invoice.
 * Metered + gated by the merchant's subscription: a run is refused (402) when
 * the plan's per-period Claude token capacity is exhausted (hard block), and the
 * run's real token usage is recorded against the period afterward. On success,
 * extracts/normalizes the invoice and runs the agent to recommend a payment
 * plan, schedule payments, and post reconciling journal entries.
 */
export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return error("invalid_json", "Request body must be valid JSON");
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return error("validation_error", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { merchantId, pdfBase64, text, invoice } = parsed.data;

  // Capacity gate (hard block) — refuse before spending any tokens.
  const capacity = await checkCapacity(merchantId);
  if (!capacity.allowed || !capacity.usagePeriodId) {
    return error("quota_exceeded", capacity.reason ?? "No capacity", 402);
  }

  const meter = new UsageMeter();
  try {
    const normalized = invoice
      ? invoice
      : pdfBase64
        ? await extractInvoiceFromPdf(pdfBase64, meter)
        : await extractInvoiceFromText(text!, meter);

    const result = await runProcureToPayAgent(normalized, meter);

    return ok({
      invoice: normalized,
      ...result,
      usage: {
        inputTokens: meter.inputTokens,
        outputTokens: meter.outputTokens,
        totalTokens: meter.totalTokens,
        remainingTokens: Math.max(0, capacity.remainingTokens - meter.totalTokens),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent run failed";
    return error("agent_error", message, 502);
  } finally {
    // Record whatever was consumed, even on partial failure, so cost is metered.
    if (meter.totalTokens > 0) {
      await recordUsage(capacity.usagePeriodId, meter.inputTokens, meter.outputTokens);
    }
  }
}
