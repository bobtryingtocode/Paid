/**
 * Model A adapter — consumer BNPL (Klarna / Affirm) presented through Stripe.
 *
 * Klarna/Affirm are not integrated directly; they are surfaced as Stripe
 * payment methods on a Checkout Session. The partner funds the merchant in full
 * and carries the repayment risk (non-recourse). Cadence records the funding as
 * a ledger event and stays out of the collection path.
 *
 * See docs/02-money-models.md (Model A) and docs/06-partner-integrations.md.
 */
import { getStripe } from "@/lib/stripe";
import type { LedgerEventInput } from "@/lib/ledger";
import type {
  CheckoutInput,
  CheckoutResult,
  PartnerAdapter,
  VerifiedWebhook,
} from "./types";

/** Cadence's share of the partner fee, in basis points (illustrative). */
const CADENCE_FEE_BPS = 100; // 1.00%

export const bnplStripeAdapter: PartnerAdapter = {
  kind: "BNPL_STRIPE",

  async beginCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    // Funds route partner → Stripe → merchant via the connected account; Cadence
    // never takes custody. The application fee is Cadence's share of the fee.
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        // Present consumer pay-over-time methods. Stripe approves & funds.
        payment_method_types: ["klarna", "affirm", "card"],
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: input.currency,
              unit_amount: input.amountCents,
              product_data: {
                name: input.description?.slice(0, 250) || "Payment",
              },
            },
          },
        ],
        payment_intent_data: {
          application_fee_amount: Math.round(
            (input.amountCents * CADENCE_FEE_BPS) / 10_000,
          ),
        },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: input.linkToken,
        metadata: { linkToken: input.linkToken },
      },
      // The connected (merchant) account receives the funds.
      { stripeAccount: input.merchantStripeAccountId },
    );

    if (!session.url) {
      throw new Error("Stripe did not return a Checkout URL");
    }
    return { redirectUrl: session.url, externalRef: session.id };
  },

  mapWebhook(raw: VerifiedWebhook): LedgerEventInput[] {
    // Funding is confirmed when the Checkout Session completes / payment succeeds.
    if (
      raw.type !== "checkout.session.completed" &&
      raw.type !== "payment_intent.succeeded"
    ) {
      return [];
    }

    const obj = extractAmount(raw.payload);
    if (obj == null) return [];

    const events: LedgerEventInput[] = [
      {
        kind: "FUNDING",
        amountCents: obj.amountCents,
        sourceEventId: raw.externalId,
      },
    ];
    const fee = Math.round((obj.amountCents * CADENCE_FEE_BPS) / 10_000);
    if (fee > 0) {
      events.push({
        kind: "FEE",
        amountCents: fee,
        sourceEventId: `${raw.externalId}:fee`,
      });
    }
    return events;
  },
};

/** Pull the funded amount out of a Stripe event object, defensively. */
function extractAmount(
  payload: unknown,
): { amountCents: number } | null {
  if (typeof payload !== "object" || payload === null) return null;
  const data = payload as {
    amount_total?: number;
    amount_received?: number;
    amount?: number;
  };
  const amount = data.amount_total ?? data.amount_received ?? data.amount;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 0) {
    return null;
  }
  return { amountCents: amount };
}
