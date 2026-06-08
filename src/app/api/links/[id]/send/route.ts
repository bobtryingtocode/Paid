import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/http";
import { currentMerchantId } from "@/auth";
import { buildBillPdf } from "@/bill/pdf";
import { sendBillEmail } from "@/notify/mailer";

export const runtime = "nodejs";

const BodySchema = z.object({ customerEmail: z.string().email() });

/**
 * POST /api/links/:id/send — generate the bill PDF and email it to the customer
 * with the hosted payment link. Auth-gated; the link must belong to the
 * authenticated merchant.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return error("unauthorized", "Sign in required", 401);

  const { id } = await params;
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

  const link = await prisma.paymentLink.findUnique({
    where: { id },
    include: { merchant: { select: { name: true } } },
  });
  if (!link || link.merchantId !== merchantId) {
    return error("not_found", "Payment link not found", 404);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const payUrl = `${appUrl}/pay/${link.token}`;
  const billNumber = link.id.slice(0, 8);
  const amountCents = Number(link.amountCents);

  const pdf = await buildBillPdf({
    merchantName: link.merchant.name,
    billNumber,
    description: link.description,
    amountCents,
    currency: link.currency,
    payUrl,
  });

  const result = await sendBillEmail({
    to: parsed.data.customerEmail,
    merchantName: link.merchant.name,
    billNumber,
    amountCents,
    currency: link.currency,
    payUrl,
    pdf,
  });

  return ok({ ...result, payUrl });
}
