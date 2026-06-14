# 17 · Testing strategy

How Noctua Pay is tested, what's covered today, and the prioritized plan to close
the gaps. Guiding principle: **guard the properties that cost money or break
compliance** — money math, idempotency, capacity hard-block, auth/ownership, and
the no-PII-in-outbound-events invariant — before chasing coverage percentages.

## The pyramid, mapped to this app

| Layer | What it covers here | Tooling |
|-------|---------------------|---------|
| **Unit (pure domain)** | Money/ledger/journal math, Model-C sweep, payment-plan recommender, workflow state machine, capacity math, payment-offerings logic, password hashing, audit payload (non-PII) | Vitest (in place) |
| **Smoke (offline pipeline)** | End-to-end procure-to-pay domain walk: recommend → schedule → journal → reconcile → capacity, with assertions | `npm run smoke` (in CI) |
| **Integration (DB)** | Prisma-backed services: entitlements (`checkCapacity`/`recordUsage`/period rollover), audit log append + journey, link funding/idempotency | Vitest + a real Postgres (Supabase branch or CI service container) |
| **Contract (external)** | Stripe webhook verify + idempotency + ledger/audit mapping; checkout-session builder (which params per method); Anthropic agent loop (tool dispatch) | Vitest with the boundary mocked (`getStripe`/`getAnthropic`), signed test payloads |
| **Component** | Client forms: login, CreateBillForm, PayOptions, PaymentSettingsForm, OnboardButton | Vitest + `@testing-library/react` + jsdom + `msw` for fetch |
| **E2E** | Hero journey: sign up → onboarding → offerings → create bill → pay page → webhook → transaction journey | Playwright vs `next dev` + seeded DB + Stripe test mode |

## Current coverage (32 unit cases, 9 files + smoke)

| File | Guards |
|------|--------|
| `money.test.ts` | cents/bps math, rounding, parse/format |
| `ledger.test.ts` | Model-A funding derivation, dedupe by source (no double-count) |
| `journal.test.ts` | double-entry balancing, drawdown, payments clear to zero |
| `p2p.test.ts` | provider quotes (pay-in-4 / Stripe fee), recommender ranking, workflow transitions |
| `billing.test.ts` | capacity hard-block, plan tiers monotonic |
| `payment-settings.test.ts` | enabled methods / display order / subscription needs a price |
| `password.test.ts` | scrypt hash/verify, unique salt, malformed input |
| `bill-pdf.test.ts` | PDF renders (magic header, non-empty), null description |
| `audit-events.test.ts` | outbound payload shape + **no PII field names** + HMAC determinism |
| `scripts/smoke.ts` | offline procure-to-pay pipeline reconciles to zero |

**CI** runs: `typecheck → test → smoke → build` on every PR
(`.github/workflows/ci.yml`).

## Gaps & prioritized backlog

**P0 — money/compliance correctness (highest value)** — ✅ done (mocked boundaries, no DB needed)
- [x] Stripe webhook handler: signature verification (400 on bad sig / missing
  secret), **idempotent intake** (already-processed event does no work), and
  `payout.paid` → journey event with `event.account` → merchant mapping.
  *(`tests/webhook-stripe.test.ts`, mocks `getStripe`/prisma/`recordEvent`)*
- [x] Entitlements: `checkCapacity` allows under allowance, **hard-blocks at/over**,
  blocks no-subscription and expired periods; `recordUsage` increments + 1 run.
  *(`tests/entitlements.test.ts`, mocked Prisma)*
- [x] Audit log: `recordEvent` writes the row (BigInt cents) and emits a
  normalized (number) record; `getJourney` queries in order.
  *(`tests/audit-log.test.ts`, mocked Prisma + emitter)*
- [x] Checkout builder: correct Stripe params per method (card / Klarna+Affirm /
  subscription), connected account + app fee, throws without a sub price.
  *(`tests/checkout.test.ts`, mocked `getStripe`)*

> Mocking `getStripe()`/`getAnthropic()`/`@/lib/prisma` let these ship in the
> existing fast CI lane with **no Postgres service and no real keys**. True
> Postgres-backed integration tests (real migrations, constraints) remain a
> worthwhile P1 follow-up via the CI service container sketched below.

**P1 — API contracts**
- [ ] Route auth/ownership/validation: 401 when signed out; 402 when over quota
  on `/api/agent/p2p`; ownership checks on `/api/links/:id/*`; method-enabled
  check on `/api/pay/:token/checkout`.
- [ ] `domain/checkout.ts`: asserts the right Stripe params per method
  (card vs Klarna/Affirm vs subscription) and the connected-account + app-fee.

**P2 — UI & journeys**
- [ ] Component tests for the four client forms (render + handler with mocked fetch).
- [ ] Playwright E2E of the hero journey against a seeded DB (Stripe test mode,
  stubbed email/agent).

## Conventions

- **Pure first.** Keep money/decision logic in pure functions (`src/domain/*`,
  `src/billing/*`, `src/audit/events.ts`) so it's unit-testable without I/O — the
  reason coverage is strong today. New financial logic ships with a unit test.
- **Boundaries are mockable.** `getStripe()` / `getAnthropic()` are lazy
  singletons; tests stub them rather than hitting the network. No test needs real
  API keys.
- **Integers only for money**; assert exact cents, never floats.
- **Idempotency is a test target**, not an afterthought — every webhook path gets
  a "duplicate delivery = no-op" test.
- **Non-PII invariant** for outbound events stays guarded by
  `audit-events.test.ts`; extend it as event types grow.

## CI evolution

When P0/P1 integration tests land, add a Postgres **service container** to
`ci.yml` and a `test:integration` step that runs `prisma migrate deploy` against
it. Keep the current fast lane (`test` + `smoke`) as the no-services gate so most
PRs stay quick; gate integration/E2E behind their own job.

```yaml
# sketch: integration job
services:
  postgres:
    image: postgres:16
    env: { POSTGRES_PASSWORD: postgres }
    ports: ["5432:5432"]
    options: >-
      --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
```
