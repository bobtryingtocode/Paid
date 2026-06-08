import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/http";
import { getPaymentOfferings, enabledMethods } from "@/merchant/payment-settings";

export const runtime = "nodejs";

/**
 * GET /api/pay/:token — public link details for the hosted payer page.
 * Token-scoped, unauthenticated, and free of any secrets. Includes the seller's
 * enabled payment methods so the page renders only what they offer.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const link = await prisma.paymentLink.findUnique({
    where: { token },
    include: { merchant: { select: { name: true, stripeAccountId: true } } },
  });
  if (!link) return error("not_found", "Payment link not found", 404);

  if (link.status !== "OPEN") {
    return error("link_unavailable", `This link is ${link.status.toLowerCase()}`, 409);
  }
  if (link.expiresAt && link.expiresAt < new Date()) {
    return error("link_expired", "This link has expired", 409);
  }

  const offerings = await getPaymentOfferings(link.merchantId);
  const methods = enabledMethods(offerings);
  const canAccept = Boolean(link.merchant.stripeAccountId);

  return ok({
    merchantName: link.merchant.name,
    amountCents: link.amountCents,
    currency: link.currency,
    description: link.description,
    methods, // ["pay_over_time", "card", "subscription"] (subset, in display order)
    canAccept, // false if the seller hasn't finished Stripe onboarding
  });
}
