# 12 · Local dev, demo data & smoke test

How to run Cadence locally and click through the whole flow.

## Smoke test (no setup required)

The fastest way to verify the core money logic — **no database, Stripe, or Claude
key needed**. It walks a sample invoice through the procure-to-pay pipeline
(recommend → schedule → journal → reconcile → capacity) and asserts the money
balances:

```bash
npm install
npm run smoke
```

Exits non-zero on any failed assertion, so it also runs in CI
(`.github/workflows/ci.yml`) alongside `typecheck`, `test`, and `build`.

## Full local run (database + services)

```bash
npm install
cp .env.example .env.local        # fill in the values below
npx prisma migrate dev            # create the schema in your Postgres
npm run db:seed                   # load demo data (idempotent)
npm run dev                       # http://localhost:3000
```

### Demo login (from the seed)

| | |
|---|---|
| Email | `demo@cadence.test` |
| Password | `password123` |

The seed (`prisma/seed.ts`) creates: the demo merchant, an **ACTIVE Pro
subscription** with a current period (~15% of tokens used, so the usage bar isn't
empty), and a sample open payment link.

### Click-through

1. **`/login`** — sign in with the demo credentials (or sign up a new merchant).
2. **`/onboarding`** — start Stripe Connect onboarding (test mode). Requires
   `STRIPE_SECRET_KEY`; completing it enables charges/payouts.
3. **`/agent`** — upload a PDF invoice or paste text → the agent recommends a
   plan, schedules payments, and reconciles. Requires `ANTHROPIC_API_KEY`.
4. **`/billing`** — see the live usage bar; subscribe/upgrade via Stripe Checkout
   (requires the `STRIPE_PRICE_*` ids + `STRIPE_BILLING_WEBHOOK_SECRET`).

### Which env vars gate what

| Flow | Needs |
|------|-------|
| Smoke test | nothing |
| Sign in / seed / usage bar | `DATABASE_URL`, `AUTH_SECRET` |
| Run the agent | `ANTHROPIC_API_KEY` |
| Connect onboarding & payouts | `STRIPE_SECRET_KEY` |
| Subscriptions | `STRIPE_PRICE_STARTER/PRO/SCALE`, `STRIPE_BILLING_WEBHOOK_SECRET` |
| Model A payment links | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |

See [`.env.example`](../.env.example) for the full list. Stripe webhooks can be
forwarded locally with the Stripe CLI (`stripe listen --forward-to
localhost:3000/api/webhooks/stripe-billing`).
