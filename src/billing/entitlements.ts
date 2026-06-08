import type { Subscription, UsagePeriod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPlan, type Plan } from "./plans";
import { hasCapacity, remainingTokens } from "./capacity";

/**
 * Entitlements: resolve a merchant's active subscription, read/advance its
 * current usage period, gate agent runs by remaining token capacity (hard
 * block), and record real usage after a run. See docs/10-metering-and-billing.md.
 */

export interface CapacityCheck {
  allowed: boolean;
  reason?: string;
  subscription?: Subscription;
  plan?: Plan;
  usagePeriodId?: string;
  usedTokens: number;
  allowanceTokens: number;
  remainingTokens: number;
}

/** The merchant's subscription if it is ACTIVE and within its current period. */
export async function getActiveSubscription(merchantId: string): Promise<Subscription | null> {
  const sub = await prisma.subscription.findUnique({ where: { merchantId } });
  if (!sub || sub.status !== "ACTIVE") return null;
  if (sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() < Date.now()) {
    return null; // period elapsed; a Stripe webhook should renew it
  }
  return sub;
}

/** Find or create the usage row for the subscription's current billing period. */
export async function getOrCreateUsagePeriod(sub: Subscription): Promise<UsagePeriod> {
  const now = new Date();
  const periodStart = sub.currentPeriodStart ?? now;
  const periodEnd = sub.currentPeriodEnd ?? new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  return prisma.usagePeriod.upsert({
    where: { subscriptionId_periodStart: { subscriptionId: sub.id, periodStart } },
    create: { subscriptionId: sub.id, periodStart, periodEnd },
    update: {},
  });
}

/** Gate a run: allowed only if the merchant has an active plan with capacity left. */
export async function checkCapacity(merchantId: string): Promise<CapacityCheck> {
  const sub = await getActiveSubscription(merchantId);
  if (!sub) {
    return {
      allowed: false,
      reason: "No active subscription. Subscribe to a plan to use the agent.",
      usedTokens: 0,
      allowanceTokens: 0,
      remainingTokens: 0,
    };
  }
  const plan = getPlan(sub.planSlug);
  if (!plan) {
    return {
      allowed: false,
      reason: `Unknown plan "${sub.planSlug}"`,
      subscription: sub,
      usedTokens: 0,
      allowanceTokens: 0,
      remainingTokens: 0,
    };
  }
  const usage = await getOrCreateUsagePeriod(sub);
  const used = Number(usage.totalTokens);
  const allowance = plan.monthlyTokens;
  const allowed = hasCapacity(allowance, used);
  return {
    allowed,
    reason: allowed ? undefined : "Token quota exhausted for this billing period. Upgrade or wait for renewal.",
    subscription: sub,
    plan,
    usagePeriodId: usage.id,
    usedTokens: used,
    allowanceTokens: allowance,
    remainingTokens: remainingTokens(allowance, used),
  };
}

/** Record actual token usage from a completed run against the usage period. */
export async function recordUsage(
  usagePeriodId: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  await prisma.usagePeriod.update({
    where: { id: usagePeriodId },
    data: {
      inputTokens: { increment: BigInt(inputTokens) },
      outputTokens: { increment: BigInt(outputTokens) },
      totalTokens: { increment: BigInt(inputTokens + outputTokens) },
      runs: { increment: 1 },
    },
  });
}

export interface SubscriptionSummary {
  hasSubscription: boolean;
  planSlug?: string;
  planName?: string;
  status?: string;
  currentPeriodEnd?: string;
  allowanceTokens: number;
  usedTokens: number;
  remainingTokens: number;
}

/** A read-only view of a merchant's plan + current usage, for a billing UI. */
export async function getSubscriptionSummary(merchantId: string): Promise<SubscriptionSummary> {
  const sub = await prisma.subscription.findUnique({ where: { merchantId } });
  if (!sub) {
    return { hasSubscription: false, allowanceTokens: 0, usedTokens: 0, remainingTokens: 0 };
  }
  const plan = getPlan(sub.planSlug);
  const usage = await getOrCreateUsagePeriod(sub);
  const used = Number(usage.totalTokens);
  const allowance = plan?.monthlyTokens ?? 0;
  return {
    hasSubscription: true,
    planSlug: sub.planSlug,
    planName: plan?.name,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString(),
    allowanceTokens: allowance,
    usedTokens: used,
    remainingTokens: remainingTokens(allowance, used),
  };
}
