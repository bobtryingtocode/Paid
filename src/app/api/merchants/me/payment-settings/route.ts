import { z } from "zod";
import { ok, error } from "@/lib/http";
import { currentMerchantId } from "@/auth";
import { getPaymentOfferings, upsertPaymentOfferings } from "@/merchant/payment-settings";

export const runtime = "nodejs";

const BodySchema = z.object({
  offerCard: z.boolean(),
  offerPayOverTime: z.boolean(),
  offerSubscription: z.boolean(),
  subscriptionPriceId: z.string().trim().min(1).nullable().optional(),
});

/** GET /api/merchants/me/payment-settings — the seller's buyer-facing offerings. */
export async function GET() {
  const merchantId = await currentMerchantId();
  if (!merchantId) return error("unauthorized", "Sign in required", 401);
  return ok(await getPaymentOfferings(merchantId));
}

/** PUT /api/merchants/me/payment-settings — update the seller's offerings. */
export async function PUT(req: Request) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return error("unauthorized", "Sign in required", 401);

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
  const { offerCard, offerPayOverTime, offerSubscription, subscriptionPriceId } = parsed.data;

  if (offerSubscription && !subscriptionPriceId) {
    return error("validation_error", "A Stripe Price ID is required to offer a subscription");
  }

  const saved = await upsertPaymentOfferings(merchantId, {
    offerCard,
    offerPayOverTime,
    offerSubscription,
    subscriptionPriceId: subscriptionPriceId ?? null,
  });
  return ok(saved);
}
