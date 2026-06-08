# Cadence

> Get the maker paid now. Let the business repay as it sells.

Cadence is a payment-link app (iOS + web) that lets small businesses get paid
**in full today** while their customer — or their own buyer, or their inventory
itself — pays over time, with a **financing partner carrying the risk**.

**Who it's for (positioning):** the hero use case is **small-business → consumer
(B2C)** — a customer who'd otherwise just tap a credit card is instead offered a
**Klarna pay-over-time plan** at checkout. The business is paid in full now,
Klarna carries the risk, and there's **no new bank/lender relationship** — it's a
checkout choice, not a financing application (Model A). The **B2B** side is the
heavier **bank/lender-style** path (net terms / inventory financing) for buyers
whose internal processes require it (Models B & C). See
[`docs/00-product-overview.md`](docs/00-product-overview.md).

Cadence is an **orchestration layer**, not a lender. It never holds, lends, or
moves customer money on its own balance sheet. It plugs into embedded-capital
and BNPL partners who hold the license, the capital, the underwriting, and the
risk, and earns a share of their fee. See
[`docs/00-product-overview.md`](docs/00-product-overview.md) for the one
decision that drives this whole design.

## The three money-flow models

| Model | Who gets paid now | Who repays, how | Best-fit partner |
|-------|-------------------|------------------|------------------|
| **A · Consumer** | The shop, in full today | Consumer, in installments (Pay-in-4 or monthly) | Klarna / Affirm via Stripe |
| **B · B2B terms** | The supplier, in full today | Business buyer, on Net 30 / 60 / 90 | Resolve Pay |
| **C · Make & sell** | The manufacturer / 3PL, upfront | The business, as a % off each sale + balloon at maturity | Kickfurther / Wayflyer / Parafin |

## What this repository currently contains

This is a **planning / specification** repository. There is no application code
yet. These documents translate the build brief & architecture into engineering
artifacts a developer and a financing partner can build and contract against.

```
docs/
  00-product-overview.md   The product, the users, the one decision that changes everything
  01-architecture.md       System architecture, components, trust boundaries, chosen stack
  02-money-models.md       Models A, B, C in detail — flows and partner roles
  03-ledger-and-sweep.md   The system of record: Model C terms, sweep math, worked example
  04-data-model.md         Entities + a Prisma schema sketch for Postgres
  05-api-design.md         REST API surface for the orchestration backend
  06-partner-integrations.md  Stripe Connect, Klarna/Affirm, Resolve, embedded-capital APIs
  07-roadmap.md            Phased build sequence (Phase 0 → 3) and out-of-scope guardrails
  08-compliance-notes.md   The orchestration-vs-lender line; what keeps us out of regulation
  09-procure-to-pay-agent.md  The in-app invoice agent (PDF → plan → schedule → reconcile)
  10-metering-and-billing.md  Sell the agent: per-token capacity + Stripe subscriptions
  11-auth-and-billing-ui.md   Auth.js (NextAuth) + the pricing/usage page
  12-local-dev-and-demo.md    Run locally, seed demo data, the smoke test
```

## Proposed stack (assumption for these docs)

- **App + API:** Next.js (App Router) + TypeScript — one shared codebase for
  web and API routes, with a clear server-only boundary for secrets and
  partner calls. React Native can reuse the TypeScript core for the Phase 2
  native iOS app.
- **Database:** PostgreSQL via Prisma ORM — the ledger is the heart of the
  product and needs a strict relational system of record.
- **Rails:** Stripe (Connect) for routing money, presenting Klarna/Affirm at
  checkout, and the automatic per-sale sweep in Model C.

The stack is recorded so the specs are concrete; it is not a commitment.
Swap-out notes live in [`docs/01-architecture.md`](docs/01-architecture.md).

## Phase 1 scaffold (Model A)

A working scaffold for **Model A** (consumer BNPL via Stripe) now lives
alongside the docs. It is the start of the Phase 1 MVP in
[`docs/07-roadmap.md`](docs/07-roadmap.md): a merchant creates a payment link, a
customer pays over time via Klarna/Affirm through Stripe, and the merchant is
funded in full, with an append-only ledger as the system of record.

```
prisma/schema.prisma          Model A subset + append-only ledger
src/lib/                      money (cents/bps), ledger, prisma, stripe (lazy), token, http
src/domain/partners/         PartnerAdapter interface + bnpl-stripe (Model A) adapter
src/app/api/                 links, pay/[token], pay/[token]/checkout, webhooks/stripe
src/app/                     minimal landing page
tests/                       vitest unit tests (money, ledger)
```

### Run it locally

```bash
npm install
cp .env.example .env.local      # fill in DATABASE_URL + Stripe keys
npx prisma generate
npx prisma migrate dev          # needs a Postgres database
npm run dev                     # http://localhost:3000
```

### Checks

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest unit tests
npm run smoke       # offline procure-to-pay pipeline walkthrough (no DB/keys)
npm run build       # next build
```

CI runs all of these on every PR (see `.github/workflows/ci.yml`).

### Demo data

`npm run db:seed` (after `npx prisma migrate dev`) loads a demo merchant
(`demo@cadence.test` / `password123`) with an active Pro plan and sample data so
you can click through `/login → /onboarding → /agent → /billing`. Full guide:
[`docs/12-local-dev-and-demo.md`](docs/12-local-dev-and-demo.md).

> **Status:** scaffold, not production. Auth is stubbed (merchant id is passed
> explicitly with `TODO(auth)` markers), and Stripe/partner calls require real
> credentials and a database to exercise end to end. Models B and C are not yet
> wired (Phases 2–3).

## Procure-to-pay invoice agent

An in-app agent ingests a **PDF invoice of project costs**, recommends a payment
plan with the supplier's financing provider (Stripe / Klarna / Afterpay),
schedules the payments, and posts reconciling **double-entry journal entries**.
It is built on the **Claude Messages API with tool use** (`claude-opus-4-8`,
adaptive thinking). Full design: [`docs/09-procure-to-pay-agent.md`](docs/09-procure-to-pay-agent.md).

```
src/agent/invoice/    canonical invoice schema + PDF/text → JSON extraction
src/agent/p2p/        the tool-use agent loop + tool definitions
src/domain/p2p/       FinancingProvider (Stripe/Klarna/Afterpay, stubbed), recommender, workflow
src/domain/accounting/journal.ts   double-entry journal + reconciliation
src/app/api/agent/p2p/route.ts     AI gateway exposing the agent over HTTP
```

Exposed at `POST /api/agent/p2p` — accepts a base64 PDF, raw invoice text, or an
already-normalized invoice; returns the normalized invoice plus the agent's
recommendation, schedule, and reconciled trial balance. Requires
`ANTHROPIC_API_KEY` (server-only). Provider scheduling is stubbed (no live
credentials in this environment); the pure modules (providers, recommender,
workflow, journal) are unit-tested.

## Selling the agent — metering & subscriptions

The agent is sold on a subscription: **customers don't bring their own API key** —
the platform holds one server-side `ANTHROPIC_API_KEY` and meters each customer's
usage in **Claude tokens** against the capacity in their plan. When the period's
capacity is exhausted, the gateway **hard-blocks** (HTTP 402). Full design:
[`docs/10-metering-and-billing.md`](docs/10-metering-and-billing.md).

```
src/billing/plans.ts          Starter / Pro / Scale tiers (token allowance + Stripe price)
src/billing/capacity.ts       Pure capacity math (hard block)
src/billing/usage.ts          UsageMeter — sums real Claude token usage across a run
src/billing/entitlements.ts   checkCapacity / recordUsage / subscription summary
src/billing/stripe-billing.ts Subscription Checkout + sync from Stripe
src/app/api/billing/*         checkout, subscription summary
src/app/api/webhooks/stripe-billing  subscription lifecycle → local Subscription
```

`POST /api/agent/p2p` is gated: it refuses with 402 when over quota and records
the run's real token usage. **Reselling note:** sell the agent-with-capacity,
not raw Claude token passthrough — see [`docs/08`](docs/08-compliance-notes.md)
and confirm with Anthropic before launch.

## Auth & customer UI

Authentication is **Auth.js (NextAuth v5)** — a Credentials provider over the
`Merchant` table with JWT sessions; the signed-in merchant id is resolved
server-side via `currentMerchantId()`. Protected routes (`/api/links`,
`/api/agent/p2p`, `/api/billing/*`) now derive the merchant from the session and
return 401 when signed out (the `TODO(auth)` stubs are gone). Full design:
[`docs/11-auth-and-billing-ui.md`](docs/11-auth-and-billing-ui.md).

- **`/login`** — sign-in / sign-up (`POST /api/auth/signup` + NextAuth credentials)
- **`/onboarding`** — Stripe **Connect** onboarding: create the connected account,
  hosted onboarding link, and live status (charges/payouts enabled). Routes:
  `POST /api/merchants/me/stripe/onboard`, `GET /api/merchants/me`. Funds route
  `partner → Stripe → merchant`; Cadence never holds funds.
- **`/agent`** — upload a PDF invoice (or paste text) and run the procure-to-pay
  agent; shows the recommended plan, schedule, reconciliation, and token usage.
  Capacity-gated (links to `/billing` on 402).
- **`/billing`** — auth-gated pricing + live usage bar (used / allowance / remaining)
- Env: `AUTH_SECRET` (session signing secret)

---

> **Not legal or financial advice.** Anything involving advancing funds,
> lending, or moving customer money carries licensing and compliance
> obligations that vary by state and by partner. Have a fintech attorney
> confirm the structure before launch — especially the line between
> "orchestration layer" and "regulated lender." Figures throughout these docs
> are illustrative.
