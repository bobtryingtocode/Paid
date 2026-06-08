/**
 * Subscription plans. Capacity is metered in Claude tokens per billing period
 * (per-token model, hard block when exhausted). Token allowances and prices are
 * illustrative — size them against your real per-run usage and Claude pricing
 * (Opus 4.8: $5 / 1M input, $25 / 1M output) plus your margin.
 *
 * The Stripe Price for each plan is supplied via env (created once in the Stripe
 * dashboard) so price IDs are never hard-coded.
 */
export type PlanSlug = "starter" | "pro" | "scale";

export interface Plan {
  slug: PlanSlug;
  name: string;
  /** Included Claude tokens (input + output) per billing period. */
  monthlyTokens: number;
  /** Display price in cents (the source of truth for charging is the Stripe Price). */
  priceCents: number;
  /** Env var holding the Stripe Price ID for this plan. */
  stripePriceEnv: string;
}

export const PLANS: Record<PlanSlug, Plan> = {
  starter: {
    slug: "starter",
    name: "Starter",
    monthlyTokens: 2_000_000,
    priceCents: 4_900,
    stripePriceEnv: "STRIPE_PRICE_STARTER",
  },
  pro: {
    slug: "pro",
    name: "Pro",
    monthlyTokens: 20_000_000,
    priceCents: 29_900,
    stripePriceEnv: "STRIPE_PRICE_PRO",
  },
  scale: {
    slug: "scale",
    name: "Scale",
    monthlyTokens: 100_000_000,
    priceCents: 99_900,
    stripePriceEnv: "STRIPE_PRICE_SCALE",
  },
};

export function isPlanSlug(value: string): value is PlanSlug {
  return value === "starter" || value === "pro" || value === "scale";
}

export function getPlan(slug: string): Plan | null {
  return isPlanSlug(slug) ? PLANS[slug] : null;
}

/** Resolve the Stripe Price ID for a plan from the environment. */
export function getStripePriceId(plan: Plan): string {
  const id = process.env[plan.stripePriceEnv];
  if (!id) {
    throw new Error(`${plan.stripePriceEnv} is not set for plan ${plan.slug}`);
  }
  return id;
}
