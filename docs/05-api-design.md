# 05 · API design

The backend exposes a REST surface (Next.js route handlers). Three audiences:

1. **Merchant API** — authenticated; the dashboard and the merchant's own
   integrations.
2. **Public payer API** — unauthenticated but token-scoped; what a hosted
   payment-link page calls.
3. **Webhooks** — inbound, signature-verified, from Stripe and partners.

Conventions: JSON; money as integer cents with explicit `currency`; idempotency
via `Idempotency-Key` header on POSTs that move money; cursor pagination;
errors as `{ "error": { "code", "message" } }`.

---

## Auth & accounts

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/auth/signup` | Create a merchant account. |
| `POST` | `/api/auth/login` | Authenticate; issue session. |
| `POST` | `/api/merchants/me/stripe/onboard` | Start Stripe Connect onboarding; returns hosted onboarding URL. |
| `GET`  | `/api/merchants/me` | Current merchant + onboarding/payout status. |

---

## Models A & B — payment links

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/links` | Create a payment link / invoice. Body: `{ model: "CONSUMER"\|"B2B_TERMS", amountCents, currency, description }`. Returns link + public `token`. |
| `GET`  | `/api/links` | List the merchant's links (paginated, filterable by status). |
| `GET`  | `/api/links/:id` | Link detail incl. funding status + ledger events. |
| `POST` | `/api/links/:id/cancel` | Cancel an open link. |

### Public payer endpoints (token-scoped)

| Method | Path | Purpose |
|--------|------|---------|
| `GET`  | `/api/pay/:token` | Public link details for the hosted payer page (amount, merchant display, available pay-over-time options). No secrets. |
| `POST` | `/api/pay/:token/checkout` | Begin checkout: Cadence creates the Stripe Checkout Session (presenting Klarna/Affirm for A) or the Resolve approval flow (B). Returns a redirect URL. |

Funding is confirmed **via webhook**, not via the client — the client redirect
only starts the flow.

---

## Model C — deals, sales, sweeps

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/deals` | Create a Model C deal. Body: `{ partnerId, advanceCents, factor, sweepRateBps, maturityDate, earlyPayoffRebateBps? }`. Returns deal with computed `capCents`. |
| `GET`  | `/api/deals` | List the merchant's deals. |
| `GET`  | `/api/deals/:id` | Deal detail: terms, `capCents`, `sweptToDateCents`, `balanceLeftCents`, status, projected balloon. |
| `POST` | `/api/deals/:id/fund` | Trigger/confirm the partner advance to the maker/3PL (records `ADVANCE` ledger event; Cadence does not move this money itself). |
| `GET`  | `/api/deals/:id/ledger` | The deal's ledger events (advance, sweeps, balloon, rebate). |
| `GET`  | `/api/deals/:id/sales` | Sales recorded for the deal (paginated). |
| `POST` | `/api/deals/:id/balloon` | Compute & initiate the maturity true-up (usually called by the scheduled maturity job, exposed for ops). |

> There is no public "create a sweep" endpoint. Sweeps are **driven by Stripe
> sale webhooks** (`charge`/`payment_intent` succeeded on the connected
> account) → the sweep engine computes the clamped sweep, executes the transfer,
> and appends `SALE` + `SWEEP` ledger events. This keeps the platform as the
> single, un-bypassable control point.

### Example: `GET /api/deals/:id`

```json
{
  "id": "deal_123",
  "status": "ACTIVE",
  "advanceCents": 10000000,
  "factor": "1.1500",
  "capCents": 11500000,
  "sweepRateBps": 4000,
  "maturityDate": "2026-12-01T00:00:00Z",
  "sweptToDateCents": 4000000,
  "balanceLeftCents": 7500000,
  "projectedBalloonCents": 7500000
}
```

---

## Webhooks (inbound, verified)

| Method | Path | Source | Effect |
|--------|------|--------|--------|
| `POST` | `/api/webhooks/stripe` | Stripe | Funding confirmations (A), connected-account sale events → sweep engine (C). Signature-verified; idempotent via event id. |
| `POST` | `/api/webhooks/resolve` | Resolve | B2B approval/funding/collection status. |
| `POST` | `/api/webhooks/partner/:kind` | Embedded-capital | Advance/funding confirmations for Model C. |

Every webhook handler: **verify signature → persist raw `WebhookEvent`
(idempotent on `(source, externalId)`) → translate into `LedgerEvent`(s) →
ack.** Reprocessing a duplicate is a no-op.

---

## Notifications

Notifications are emitted as side effects of the flows above (link created →
send link; funding confirmed → send receipt; deal milestones/maturity →
reminders). No separate public send endpoint in v1; an internal
`Notifier.send()` is invoked by services. See
[`01-architecture.md`](01-architecture.md).

## Cross-cutting

- **Idempotency:** money-moving POSTs require `Idempotency-Key`; replays return
  the original result.
- **Authorization:** merchant endpoints scoped to the authenticated merchant;
  a merchant can only see its own links/deals/ledger.
- **Validation:** all money is integer cents ≥ 0; `factor` and `sweepRateBps`
  range-checked against the agreed term ranges in
  [`03-ledger-and-sweep.md`](03-ledger-and-sweep.md).
- **Read models:** balances returned by the API are derived from ledger events
  (or a reconciled running total), never hand-edited.
