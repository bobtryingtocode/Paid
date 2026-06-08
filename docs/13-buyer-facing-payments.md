# 13 · Buyer-facing payments (service businesses)

For small landscaping / contracting / service companies: after a job, the seller
sends the customer a bill with a payment link; the customer lands on a hosted
page that offers **only the payment methods the seller enabled** and routes to
Stripe. The seller is paid into their connected account; Cadence never holds
funds and never stores bank numbers.

This document covers the spine that's built: **seller payment offerings** + the
**hosted buyer pay page**. (PDF bill generation, email delivery, and the buyer
intake/survey are the next pieces — see [`07`](07-roadmap.md).)

## Seller side — payment offerings

`/settings/payments` (auth-gated) lets a seller toggle what buyers can do:

| Offering | Meaning |
|----------|---------|
| **Pay over time (Klarna/Affirm)** | The hero B2C option — seller paid in full now, partner carries the risk |
| **Card / debit** | Standard one-time payment |
| **Subscription** | Ongoing service billed on the seller's Stripe Price (`subscriptionPriceId` on their connected account) |

Stored in `MerchantPaymentSettings` (1:1 with `Merchant`). Service +
pure helpers in `src/merchant/payment-settings.ts`:

- `getPaymentOfferings(merchantId)` / `upsertPaymentOfferings(...)`
- `enabledMethods(offerings)` → the buyer's choices in display order
  (pay-over-time first); subscription only appears when a price id is set.

API: `GET` / `PUT /api/merchants/me/payment-settings` (auth-gated).

## Buyer side — hosted pay page

`/pay/[token]` (public, token-scoped, no secrets):

1. Loads the bill (the `PaymentLink`) and the seller's enabled methods.
2. Renders one button per enabled method (Klarna highlighted as the hero
   option). Shows a clear "not ready" state if the seller hasn't finished Stripe
   onboarding.
3. On choice → `POST /api/pay/[token]/checkout { method }` validates the method
   is offered, then builds the matching **Stripe Checkout Session on the seller's
   connected account** (`src/domain/checkout.ts`):
   - `card` → card only, pay now
   - `pay_over_time` → Klarna/Affirm via Stripe; seller paid in full
   - `subscription` → subscription mode on the seller's Stripe Price
   Each is a direct charge on the connected account with a Cadence application
   fee; funds settle to the seller's bank (held by Stripe). Funding is confirmed
   by webhook, not the client.
4. `/pay/[token]/success` after redirect back from Stripe.

## Payouts & bank details

The seller's ACH account + routing are collected and **held by Stripe** during
Connect onboarding ([`/onboarding`](11-auth-and-billing-ui.md) → Connect). They
are the connected account's payout destination, so charges settle there
automatically. Cadence stores **no** raw bank numbers — avoiding the PCI/PII and
encryption burden that storing routing/account numbers would create.

## Status & guardrails

- Requires the seller to be Stripe-onboarded (`stripeAccountId`) to accept
  payment; the buyer page degrades gracefully otherwise.
- Subscription checkout assumes the seller's `subscriptionPriceId` exists on
  their connected account.
- Still to come: generated **PDF bill + email delivery** and the **buyer intake +
  survey** step before the payment page.
