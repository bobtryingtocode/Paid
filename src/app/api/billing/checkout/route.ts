import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/http";
import { getPlan } from "@/billing/plans";
import { createSubscriptionCheckout } from "@/billing/stripe-billing";
import { currentMerchantId } from "@/auth";

export const runtime = "nodejs";

const BodySchema = z.object({
  planSlug: z.string().min(1),
});

/** POST /api/billing/checkout — start a subscription Checkout for a plan. */
export async function POST(req: Request) {
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
  const { planSlug } = parsed.data;

  const plan = getPlan(planSlug);
  if (!plan) return error("unknown_plan", `Unknown plan "${planSlug}"`, 404);

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) return error("merchant_not_found", "Unknown merchant", 404);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = await createSubscriptionCheckout(merchant, plan, appUrl);
  return ok({ url });
}
