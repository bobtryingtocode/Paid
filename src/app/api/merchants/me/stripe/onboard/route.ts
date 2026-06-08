import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/http";
import { currentMerchantId } from "@/auth";
import { ensureConnectAccount, createOnboardingLink } from "@/merchant/connect";

export const runtime = "nodejs";

/**
 * POST /api/merchants/me/stripe/onboard — start (or resume) Stripe Connect
 * onboarding for the authenticated merchant. Returns a hosted onboarding URL.
 */
export async function POST() {
  const merchantId = await currentMerchantId();
  if (!merchantId) return error("unauthorized", "Sign in required", 401);

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) return error("merchant_not_found", "Unknown merchant", 404);

  const accountId = await ensureConnectAccount(merchant);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = await createOnboardingLink(accountId, appUrl);
  return ok({ url });
}
