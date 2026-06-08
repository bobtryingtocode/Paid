/**
 * Partner adapter interface. Each financing partner is integrated behind this
 * single contract so the rest of the system depends on normalized ledger events,
 * not partner specifics. See docs/06-partner-integrations.md.
 */
import type { LedgerEventInput } from "@/lib/ledger";

export type PartnerKind = "BNPL_STRIPE" | "RESOLVE" | "EMBEDDED_CAPITAL";

export interface CheckoutInput {
  /** The public link token the payer opened. */
  linkToken: string;
  amountCents: number;
  currency: string;
  description?: string;
  /** Stripe Connect account of the merchant being funded. */
  merchantStripeAccountId: string;
  /** Where Stripe should send the payer after success / cancel. */
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  /** URL the client redirects the payer to in order to start the flow. */
  redirectUrl: string;
  /** Provider-side id for the started session, for later correlation. */
  externalRef: string;
}

export interface VerifiedWebhook {
  source: string;
  externalId: string;
  type: string;
  payload: unknown;
}

export interface PartnerAdapter {
  kind: PartnerKind;
  /** Models A/B: get the payer approved and the merchant funded in full. */
  beginCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** Map a verified inbound webhook into normalized domain ledger events. */
  mapWebhook(raw: VerifiedWebhook): LedgerEventInput[];
}
