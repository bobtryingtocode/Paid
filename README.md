# Cadence

> Get the maker paid now. Let the business repay as it sells.

Cadence is a payment-link app (iOS + web) that lets small businesses get paid
**in full today** while their customer — or their own buyer, or their inventory
itself — pays over time, with a **financing partner carrying the risk**.

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
npm test            # vitest (money + ledger)
npm run build       # next build
```

CI runs all three on every PR (see `.github/workflows/ci.yml`).

> **Status:** scaffold, not production. Auth is stubbed (merchant id is passed
> explicitly with `TODO(auth)` markers), and Stripe/partner calls require real
> credentials and a database to exercise end to end. Models B and C are not yet
> wired (Phases 2–3).

---

> **Not legal or financial advice.** Anything involving advancing funds,
> lending, or moving customer money carries licensing and compliance
> obligations that vary by state and by partner. Have a fintech attorney
> confirm the structure before launch — especially the line between
> "orchestration layer" and "regulated lender." Figures throughout these docs
> are illustrative.
