import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/http";
import { buildCheckoutSession } from "@/domain/checkout";
import { getPaymentOfferings, isMethodEnabled } from "@/merchant/payment-settings";

export const runtime = "nodejs";

const BodySchema = z.object({
  method: z.enum(["card", "pay_over_time", "subscription"]),
});

/**
 * POST /api/pay/:token/checkout — begin checkout for the buyer's chosen method.
 * Validates the method is one the seller offers, then builds the matching Stripe
 * Checkout Session on the seller's connected account. Funding is confirmed via
 * webhook, not by the client.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

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
  const { method } = parsed.data;

  const link = await prisma.paymentLink.findUnique({
    where: { token },
    include: { merchant: true },
  });
  if (!link) return error("not_found", "Payment link not found", 404);
  if (link.status !== "OPEN") {
    return error("link_unavailable", `This link is ${link.status.toLowerCase()}`, 409);
  }
  if (!link.merchant.stripeAccountId) {
    return error("merchant_not_onboarded", "Seller has not finished Stripe onboarding", 409);
  }

  const offerings = await getPaymentOfferings(link.merchantId);
  if (!isMethodEnabled(offerings, method)) {
    return error("method_unavailable", "That payment method isn't offered for this bill", 409);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = await buildCheckoutSession({
    method,
    linkToken: link.token,
    amountCents: Number(link.amountCents),
    currency: link.currency,
    description: link.description ?? undefined,
    merchantStripeAccountId: link.merchant.stripeAccountId,
    offerings,
    successUrl: `${appUrl}/pay/${link.token}/success`,
    cancelUrl: `${appUrl}/pay/${link.token}`,
  });

  return ok({ redirectUrl: url });
}
