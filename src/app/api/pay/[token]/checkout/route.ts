import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/http";
import { bnplStripeAdapter } from "@/domain/partners/bnpl-stripe";

export const runtime = "nodejs";

/**
 * POST /api/pay/:token/checkout — begin checkout for a Model A link.
 * Cadence builds the Stripe Checkout Session (Klarna/Affirm) and returns a
 * redirect URL. Funding is confirmed later via webhook, not by the client.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const link = await prisma.paymentLink.findUnique({
    where: { token },
    include: { merchant: true },
  });
  if (!link) return error("not_found", "Payment link not found", 404);
  if (link.status !== "OPEN") {
    return error("link_unavailable", `This link is ${link.status.toLowerCase()}`, 409);
  }
  if (!link.merchant.stripeAccountId) {
    return error(
      "merchant_not_onboarded",
      "Merchant has not completed Stripe Connect onboarding",
      409,
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const result = await bnplStripeAdapter.beginCheckout({
    linkToken: link.token,
    amountCents: Number(link.amountCents),
    currency: link.currency,
    description: link.description ?? undefined,
    merchantStripeAccountId: link.merchant.stripeAccountId,
    successUrl: `${appUrl}/pay/${link.token}/success`,
    cancelUrl: `${appUrl}/pay/${link.token}`,
  });

  return ok({ redirectUrl: result.redirectUrl });
}
