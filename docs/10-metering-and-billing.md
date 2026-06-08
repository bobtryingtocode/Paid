# 10 · Metering & subscription billing

Sell the procure-to-pay agent ([`09`](09-procure-to-pay-agent.md)) as a
subscription. Customers **do not bring their own API key** — the platform holds a
single server-side `ANTHROPIC_API_KEY`, and each customer's usage is metered in
**Claude tokens** against the capacity included in their plan. When a plan's
per-period capacity is exhausted, the agent gateway **hard-blocks** further runs
(HTTP 402) until renewal or upgrade.

> **Reselling note (not legal advice).** Building a value-added product on the
> Claude API (this metered agent) is ordinary SaaS. Reselling *raw, pass-through*
> Claude API access can fall under Anthropic's commercial terms / usage policies
> and may need their sign-off. Frame the offering as "buy the agent with an
> included capacity allowance," not "buy Claude tokens through us," and confirm
> with Anthropic / an attorney before launch. See [`08`](08-compliance-notes.md).

## How metering works

```
request → checkCapacity(merchant) ──blocked──▶ 402 quota_exceeded
              │ allowed
              ▼
        run agent (extraction + tool loop)
              │  UsageMeter sums real Claude token usage across every model call
              ▼
        recordUsage(period, input, output)  → increments the period's totalTokens
              ▼
        response includes usage + remainingTokens
```

- **Unit:** Claude tokens (`input_tokens` + `output_tokens`, with cache tokens
  counted as input), summed across the extraction call and every agent tool-loop
  turn by `UsageMeter` (`src/billing/usage.ts`).
- **Gate:** hard block — a run is allowed only while the period's used tokens are
  below the plan allowance (`src/billing/capacity.ts`). A run already in flight
  may overshoot slightly (per-token cost isn't known until it completes); the
  *next* run is then blocked.
- **Recording:** real usage is written even on partial failure (the route's
  `finally`), so cost is always metered.

## Plans

Defined in `src/billing/plans.ts` (token allowances and prices illustrative —
size them against real per-run usage and Claude pricing plus your margin):

| Plan | Included tokens / period | Price (display) |
|------|--------------------------|-----------------|
| Starter | 2,000,000 | $49 |
| Pro | 20,000,000 | $299 |
| Scale | 100,000,000 | $999 |

Each plan's Stripe Price ID comes from env (`STRIPE_PRICE_STARTER` / `_PRO` /
`_SCALE`) — created once in the Stripe dashboard, never hard-coded.

## Data model (Prisma)

- **`Subscription`** — one per merchant: `planSlug`, `status`
  (`INCOMPLETE`/`ACTIVE`/`PAST_DUE`/`CANCELED`), Stripe customer/subscription
  ids, and `currentPeriodStart`/`End` mirrored from Stripe.
- **`UsagePeriod`** — cumulative `inputTokens` / `outputTokens` / `totalTokens` /
  `runs` for one subscription within one billing period (unique on
  `subscriptionId + periodStart`). Enforcement reads `totalTokens`; recording
  increments it.

## Stripe Billing

Platform-level billing (your Stripe account), distinct from the Connect flows
that route merchant payouts.

| Endpoint | Purpose |
|----------|---------|
| `POST /api/billing/checkout` | Start a subscription Checkout for `{ merchantId, planSlug }`; returns the Stripe URL. |
| `GET /api/billing/subscription?merchantId=` | Plan + current-period usage summary (allowance, used, remaining). |
| `POST /api/webhooks/stripe-billing` | Subscription lifecycle (`checkout.session.completed`, `customer.subscription.*`) → upsert the local `Subscription` and its period dates. Signature-verified, idempotent. |

The webhook uses a **separate** secret (`STRIPE_BILLING_WEBHOOK_SECRET`) so it
can be its own Stripe endpoint, independent of the payments webhook.

## Enforcement on the gateway

`POST /api/agent/p2p` now requires `merchantId` (auth stubbed with `TODO(auth)`),
calls `checkCapacity` before doing any work, and records usage afterward. The
response carries the run's token `usage` and the merchant's `remainingTokens`.

## Status & guardrails

- Subscription gating, usage metering, and the Stripe wiring are implemented;
  the pure capacity/plan logic is unit-tested. Live Stripe Prices, a database,
  and the platform Anthropic key are needed to exercise it end to end.
- Hard-block protects the platform from cost overruns; per-token overshoot on the
  final in-flight run is bounded by `max_tokens` per model call.
- Auth is still stubbed (`merchantId` passed explicitly); wire real auth before
  exposing billing endpoints publicly.
