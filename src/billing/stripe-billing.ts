import type Stripe from "stripe";
import type { Merchant } from "@prisma/client";
import { SubscriptionStatus } from "@prisma/client";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getStripePriceId, type Plan } from "./plans";

/**
 * Stripe Billing wiring for subscriptions. Checkout starts a subscription;
 * webhooks keep our Subscription row in sync. This is platform-level billing
 * (your Stripe account), distinct from the Connect flows that route merchant
 * payouts in src/lib/stripe.ts.
 */

/** Start a subscription Checkout for a merchant on a given plan; returns the URL. */
export async function createSubscriptionCheckout(
  merchant: Merchant,
  plan: Plan,
  appUrl: string,
): Promise<string> {
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: getStripePriceId(plan), quantity: 1 }],
    customer_email: merchant.email,
    success_url: `${appUrl}/billing?status=success`,
    cancel_url: `${appUrl}/billing?status=cancelled`,
    metadata: { merchantId: merchant.id, planSlug: plan.slug },
    subscription_data: { metadata: { merchantId: merchant.id, planSlug: plan.slug } },
  });
  if (!session.url) throw new Error("Stripe did not return a Checkout URL");
  return session.url;
}

function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return SubscriptionStatus.ACTIVE;
    case "past_due":
    case "unpaid":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
    case "incomplete_expired":
      return SubscriptionStatus.CANCELED;
    default:
      return SubscriptionStatus.INCOMPLETE;
  }
}

const customerId = (c: string | Stripe.Customer | Stripe.DeletedCustomer): string =>
  typeof c === "string" ? c : c.id;

/** Pull a subscription from Stripe and upsert our local record from its metadata. */
export async function syncSubscription(stripeSubscriptionId: string): Promise<void> {
  const sub = await getStripe().subscriptions.retrieve(stripeSubscriptionId);
  const merchantId = sub.metadata?.merchantId;
  const planSlug = sub.metadata?.planSlug;
  if (!merchantId || !planSlug) return; // not one of ours

  const data = {
    planSlug,
    status: mapStatus(sub.status),
    stripeCustomerId: customerId(sub.customer),
    stripeSubscriptionId: sub.id,
    currentPeriodStart: new Date(sub.current_period_start * 1000),
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
  };

  await prisma.subscription.upsert({
    where: { merchantId },
    create: { merchantId, ...data },
    update: data,
  });
}
