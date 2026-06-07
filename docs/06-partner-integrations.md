# 06 · Partner integrations

Cadence integrates partners behind a single **`PartnerAdapter`** interface so
the rest of the system depends on ledger events, not partner specifics. Each
adapter implements: **approve/originate → fund → map webhooks → (Model C) sweep
support.**

> Provider note (from the brief): Klarna/Affirm (consumer), Resolve Pay (B2B net
> terms), and Kickfurther / Wayflyer / Parafin (inventory & revenue-based) are
> named as the current best-fit partners; the right one depends on niche, ticket
> size, and geography, and **terms should be confirmed directly with each.**

## The adapter interface (sketch)

```ts
interface PartnerAdapter {
  kind: PartnerKind;
  // Models A/B: get the payer approved and the merchant funded in full.
  beginCheckout(input: CheckoutInput): Promise<{ redirectUrl: string }>;
  // Map a verified inbound webhook into normalized domain events.
  mapWebhook(raw: VerifiedWebhook): LedgerEventDraft[];
  // Model C only: confirm advance to maker; sweeps run via Stripe rails.
  confirmAdvance?(dealId: string): Promise<LedgerEventDraft>;
}
```

---

## Stripe — the rails (all models)

Stripe is the money-movement layer for the whole product.

- **Stripe Connect:** merchants onboard as connected accounts so funds route
  `partner → Stripe → merchant` and Cadence never takes custody. Use hosted
  onboarding for KYC.
- **Checkout + BNPL (Model A):** present **Klarna / Affirm** as payment methods
  on a Stripe Checkout Session. The partner funds; the merchant is paid in full;
  next-day payout.
- **The sweep (Model C):** sales run through the connected account; on each sale
  webhook the sweep engine moves the clamped "% off the top" to the financer
  (via application fee / transfer) and keeps the remainder with the business.
- **Webhooks:** `/api/webhooks/stripe` — verify signature, persist raw event,
  translate to ledger events. Critical events: checkout/payment_intent
  succeeded (A funding), charge/payment_intent succeeded on connected account
  (C sales → sweep), payout events (merchant funding visibility).

Secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, Connect client config.
Never `NEXT_PUBLIC_*`.

---

## Klarna / Affirm via Stripe — Model A (consumer)

- Not a direct integration: surfaced **through Stripe** as payment methods.
- Adapter `kind = BNPL_STRIPE`. `beginCheckout` builds the Stripe Checkout
  Session with Klarna/Affirm enabled; funding confirmation arrives on the Stripe
  webhook.
- Repayment (Pay-in-4 / monthly) is entirely the partner's; Cadence records the
  funding event and is **not** in the collection path.

---

## Resolve Pay — Model B (B2B net terms)

- Adapter `kind = RESOLVE`. Buyer is approved for Net 30/60/90; supplier paid in
  full now; Resolve collects on the due date (non-recourse to the merchant per
  partner terms — confirm).
- `beginCheckout` originates the terms application; `mapWebhook` ingests
  approval/funding/collection status into ledger events.
- Secrets: `RESOLVE_API_KEY`, `RESOLVE_WEBHOOK_SECRET`.

---

## Embedded-capital (Kickfurther / Wayflyer / Parafin) — Model C

- Adapter `kind = EMBEDDED_CAPITAL`. The financer pays the contract
  manufacturer / 3PL **upfront** on day 0.
- `confirmAdvance` records the `ADVANCE` ledger event when the partner confirms
  it has paid the maker. Cadence **does not move the advance itself.**
- Ongoing repayment is the **Stripe sweep** (see Model C above) plus the
  **balloon true-up** at maturity — Cadence's ledger + Stripe drive these, not
  the partner.
- Enforceability hooks the partner relies on (see
  [`03-ledger-and-sweep.md`](03-ledger-and-sweep.md)): sales-through-platform
  control, inventory-as-collateral (UCC lien, often a personal guarantee), and
  Cadence as the automatic system of record for reconciliation.
- Secrets: per-partner `*_API_KEY`, `*_WEBHOOK_SECRET`.

---

## Webhook intake contract (all partners)

Every inbound webhook follows the same path:

1. **Verify** the signature with the partner's signing secret. Reject if
   invalid.
2. **Persist** the raw event as `WebhookEvent`, unique on `(source,
   externalId)` → duplicates are no-ops (idempotent).
3. **Translate** via the adapter's `mapWebhook` into one or more `LedgerEvent`s,
   each carrying a `sourceEventId` for idempotency.
4. **Ack** quickly; do heavy work async if needed.

## Secret management

| Secret | Used by | Notes |
|--------|---------|-------|
| `STRIPE_SECRET_KEY` | Rails (all models) | Server-only. |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verify | Server-only. |
| `RESOLVE_API_KEY` / `RESOLVE_WEBHOOK_SECRET` | Model B | Server-only. |
| `<EMBEDDED>_API_KEY` / `<EMBEDDED>_WEBHOOK_SECRET` | Model C | One pair per partner. |
| `DATABASE_URL` | Prisma | Server-only. |
| Notifier keys (email/SMS) | Notifications | Server-only. |

All secrets live in server environment / platform secret store. No partner
secret ever ships to the client. See [`01-architecture.md`](01-architecture.md).
