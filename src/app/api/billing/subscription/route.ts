import { ok, error } from "@/lib/http";
import { getSubscriptionSummary } from "@/billing/entitlements";

export const runtime = "nodejs";

/** GET /api/billing/subscription?merchantId= — plan + current usage summary. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  // TODO(auth): scope to the authenticated merchant.
  const merchantId = url.searchParams.get("merchantId");
  if (!merchantId) return error("validation_error", "merchantId is required");

  const summary = await getSubscriptionSummary(merchantId);
  return ok(summary);
}
