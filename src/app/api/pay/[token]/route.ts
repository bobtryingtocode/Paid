import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/http";

export const runtime = "nodejs";

/**
 * GET /api/pay/:token — public link details for the hosted payer page.
 * Token-scoped, unauthenticated, and free of any secrets.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const link = await prisma.paymentLink.findUnique({
    where: { token },
    include: { merchant: { select: { name: true } } },
  });
  if (!link) return error("not_found", "Payment link not found", 404);

  if (link.status !== "OPEN") {
    return error("link_unavailable", `This link is ${link.status.toLowerCase()}`, 409);
  }
  if (link.expiresAt && link.expiresAt < new Date()) {
    return error("link_expired", "This link has expired", 409);
  }

  // Only public fields — no merchant id, no internal ids beyond what the payer needs.
  return ok({
    merchantName: link.merchant.name,
    amountCents: link.amountCents,
    currency: link.currency,
    description: link.description,
    payOverTime: ["klarna", "affirm"],
  });
}
