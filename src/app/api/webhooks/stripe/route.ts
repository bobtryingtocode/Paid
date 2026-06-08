import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { bnplStripeAdapter } from "@/domain/partners/bnpl-stripe";
import { error } from "@/lib/http";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/webhooks/stripe — verify, ingest, and translate Stripe events.
 *
 * Path: verify signature → persist raw WebhookEvent (idempotent on
 * (source, externalId)) → translate into ledger events → ack. Reprocessing a
 * duplicate is a no-op. See docs/05-api-design.md and docs/06-partner-integrations.md.
 */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return error("webhook_unconfigured", "Missing signature or webhook secret", 400);
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return error(
      "signature_verification_failed",
      err instanceof Error ? err.message : "Invalid signature",
      400,
    );
  }

  // Idempotent intake: a duplicate delivery is recorded once and short-circuits.
  const existing = await prisma.webhookEvent.findUnique({
    where: { source_externalId: { source: "stripe", externalId: event.id } },
  });
  if (existing?.processedAt) {
    return NextResponse.json({ received: true, duplicate: true });
  }
  if (!existing) {
    await prisma.webhookEvent.create({
      data: {
        source: "stripe",
        externalId: event.id,
        payload: event as unknown as object,
        verifiedAt: new Date(),
      },
    });
  }

  await handleEvent(event);

  await prisma.webhookEvent.update({
    where: { source_externalId: { source: "stripe", externalId: event.id } },
    data: { processedAt: new Date() },
  });

  return NextResponse.json({ received: true });
}

async function handleEvent(event: Stripe.Event) {
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "payment_intent.succeeded"
  ) {
    return; // not a funding event we act on yet
  }

  const obj = event.data.object as {
    client_reference_id?: string | null;
    metadata?: Record<string, string> | null;
  };
  const linkToken = obj.client_reference_id ?? obj.metadata?.linkToken;
  if (!linkToken) return;

  const link = await prisma.paymentLink.findUnique({ where: { token: linkToken } });
  if (!link || link.status === "FUNDED") return;

  const ledgerEvents = bnplStripeAdapter.mapWebhook({
    source: "stripe",
    externalId: event.id,
    type: event.type,
    payload: event.data.object,
  });
  if (ledgerEvents.length === 0) return;

  const partner = await prisma.partner.upsert({
    where: { id: "bnpl_stripe" },
    update: {},
    create: { id: "bnpl_stripe", kind: "BNPL_STRIPE", displayName: "Klarna / Affirm (via Stripe)" },
  });

  const funding = ledgerEvents.find((e) => e.kind === "FUNDING");
  const fee = ledgerEvents.find((e) => e.kind === "FEE");

  // One transaction per link; ledger events recorded immutably, marked funded.
  await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        paymentLinkId: link.id,
        partnerId: partner.id,
        amountCents: BigInt(funding?.amountCents ?? 0),
        feeCents: BigInt(fee?.amountCents ?? 0),
        fundedAt: new Date(),
        ledgerEvents: {
          create: ledgerEvents.map((e) => ({
            kind: e.kind,
            amountCents: BigInt(e.amountCents),
            currency: link.currency,
            sourceEventId: e.sourceEventId,
          })),
        },
      },
    });
    await tx.paymentLink.update({
      where: { id: link.id },
      data: { status: "FUNDED" },
    });
    return transaction;
  });
}
