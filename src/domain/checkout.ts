import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import type { PaymentMethodChoice, PaymentOfferings } from "@/merchant/payment-settings";

/** Cadence's share of the transaction, as an application fee (basis points). */
export const CADENCE_FEE_BPS = 100; // 1.00%

export interface BuildCheckoutInput {
  method: PaymentMethodChoice;
  linkToken: string;
  amountCents: number;
  currency: string;
  description?: string;
  /** The seller's Stripe Connect account — funds settle to its bank. */
  merchantStripeAccountId: string;
  offerings: PaymentOfferings;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Build the right Stripe Checkout Session for the buyer's chosen method, as a
 * direct charge on the seller's connected account (so payouts go to the seller;
 * Cadence takes an application fee). Returns the redirect URL.
 *
 * - card          → pay now, card/debit only
 * - pay_over_time → Klarna/Affirm via Stripe; seller is paid in full now
 * - subscription  → ongoing service on the seller's configured Stripe Price
 */
export async function buildCheckoutSession(input: BuildCheckoutInput): Promise<string> {
  const stripe = getStripe();
  const onConnected = { stripeAccount: input.merchantStripeAccountId };

  if (input.method === "subscription") {
    if (!input.offerings.subscriptionPriceId) {
      throw new Error("Subscription is not configured for this seller");
    }
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        line_items: [{ price: input.offerings.subscriptionPriceId, quantity: 1 }],
        subscription_data: { application_fee_percent: CADENCE_FEE_BPS / 100 },
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        client_reference_id: input.linkToken,
        metadata: { linkToken: input.linkToken },
      },
      onConnected,
    );
    return requireUrl(session.url);
  }

  const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
    input.method === "card" ? ["card"] : ["klarna", "affirm", "card"];
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: paymentMethodTypes,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency,
            unit_amount: input.amountCents,
            product_data: { name: input.description?.slice(0, 250) || "Payment" },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: Math.round((input.amountCents * CADENCE_FEE_BPS) / 10_000),
      },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.linkToken,
      metadata: { linkToken: input.linkToken },
    },
    onConnected,
  );
  return requireUrl(session.url);
}

function requireUrl(url: string | null): string {
  if (!url) throw new Error("Stripe did not return a Checkout URL");
  return url;
}
