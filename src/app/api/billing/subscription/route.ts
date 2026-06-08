import { ok, error } from "@/lib/http";
import { getSubscriptionSummary } from "@/billing/entitlements";
import { currentMerchantId } from "@/auth";

export const runtime = "nodejs";

/** GET /api/billing/subscription — the authenticated merchant's plan + usage. */
export async function GET() {
  const merchantId = await currentMerchantId();
  if (!merchantId) return error("unauthorized", "Sign in required", 401);

  const summary = await getSubscriptionSummary(merchantId);
  return ok(summary);
}
