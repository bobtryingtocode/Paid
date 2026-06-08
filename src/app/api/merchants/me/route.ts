import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/http";
import { currentMerchantId } from "@/auth";
import { getConnectStatus } from "@/merchant/connect";

export const runtime = "nodejs";

/** GET /api/merchants/me — the authenticated merchant + Connect onboarding status. */
export async function GET() {
  const merchantId = await currentMerchantId();
  if (!merchantId) return error("unauthorized", "Sign in required", 401);

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) return error("merchant_not_found", "Unknown merchant", 404);

  const connect = await getConnectStatus(merchant);
  return ok({
    id: merchant.id,
    name: merchant.name,
    email: merchant.email,
    stripeAccountId: merchant.stripeAccountId,
    connect,
  });
}
