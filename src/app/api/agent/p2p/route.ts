import { z } from "zod";
import { ok, error } from "@/lib/http";
import { CanonicalInvoiceSchema } from "@/agent/invoice/schema";
import { extractInvoiceFromPdf, extractInvoiceFromText } from "@/agent/invoice/extract";
import { runProcureToPayAgent } from "@/agent/p2p/agent";

export const runtime = "nodejs";
// Agent runs can take a while (extraction + multi-turn tool loop).
export const maxDuration = 300;

const BodySchema = z
  .object({
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
 * Extracts/normalizes it, then runs the agent to recommend a payment plan,
 * schedule payments through a financing provider, and post reconciling journal
 * entries. Returns the normalized invoice plus the agent's summary and result.
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
  const { pdfBase64, text, invoice } = parsed.data;

  try {
    const normalized = invoice
      ? invoice
      : pdfBase64
        ? await extractInvoiceFromPdf(pdfBase64)
        : await extractInvoiceFromText(text!);

    const result = await runProcureToPayAgent(normalized);
    return ok({ invoice: normalized, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent run failed";
    return error("agent_error", message, 502);
  }
}
