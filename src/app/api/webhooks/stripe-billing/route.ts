import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { error } from "@/lib/http";
import { syncSubscription } from "@/billing/stripe-billing";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/stripe-billing — subscription lifecycle events.
 *
 * Verifies the signature, records the event idempotently, then syncs the
 * affected subscription into our local Subscription row. Uses a billing-specific
 * webhook secret so it can be a separate Stripe endpoint from the payments one.
 */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return error("webhook_unconfigured", "Missing signature or webhook secret", 400);
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    return error(
      "signature_verification_failed",
      err instanceof Error ? err.message : "Invalid signature",
      400,
    );
  }

  const existing = await prisma.webhookEvent.findUnique({
    where: { source_externalId: { source: "stripe_billing", externalId: event.id } },
  });
  if (existing?.processedAt) {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (!existing) {
    await prisma.webhookEvent.create({
      data: {
        source: "stripe_billing",
        externalId: event.id,
        payload: event as unknown as object,
        verifiedAt: new Date(),
      },
    });
  }

  await handleEvent(event);

  await prisma.webhookEvent.update({
    where: { source_externalId: { source: "stripe_billing", externalId: event.id } },
    data: { processedAt: new Date() },
  });

  return NextResponse.json({ received: true });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || !session.subscription) return;
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id;
      await syncSubscription(subId);
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await syncSubscription(sub.id);
      return;
    }
    default:
      return; // ignore other events
  }
}
