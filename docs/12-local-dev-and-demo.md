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

## Database — Supabase

The database is **Supabase** (hosted Postgres). Prisma connects with two URLs:

- `DATABASE_URL` — the **pooled** connection (Supavisor, port 6543, `?pgbouncer=true`),
  used by the app at runtime.
- `DIRECT_URL` — the **direct** connection (port 5432), used by Prisma for
  migrations (`directUrl` in `prisma/schema.prisma`).

Setup:

1. Create a project at [supabase.com](https://supabase.com).
2. Project Settings → Database → Connection string → copy both the **Transaction**
   (pooled, 6543) and **Session/Direct** (5432) strings into `DATABASE_URL` and
   `DIRECT_URL` in `.env.local` (see [`.env.example`](../.env.example)).
3. Run the migration + seed below — they create the schema and demo data in your
   Supabase project.

> No app code is Supabase-specific: it's plain Postgres via Prisma, so the schema,
> migrations, and queries are unchanged. (Supabase Auth/Storage aren't used —
> auth is Auth.js; if you later want Supabase Storage for PDF bills, add
> `@supabase/supabase-js` then.)

## Full local run (database + services)

```bash
npm install
cp .env.example .env.local        # fill in DATABASE_URL + DIRECT_URL (Supabase) + the rest
npx prisma migrate dev            # create the schema in Supabase (uses DIRECT_URL)
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
| Sign in / seed / usage bar | `DATABASE_URL` + `DIRECT_URL` (Supabase), `AUTH_SECRET` |
| Run the agent | `ANTHROPIC_API_KEY` |
| Connect onboarding & payouts | `STRIPE_SECRET_KEY` |
| Subscriptions | `STRIPE_PRICE_STARTER/PRO/SCALE`, `STRIPE_BILLING_WEBHOOK_SECRET` |
| Model A payment links | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |

See [`.env.example`](../.env.example) for the full list. Stripe webhooks can be
forwarded locally with the Stripe CLI (`stripe listen --forward-to
localhost:3000/api/webhooks/stripe-billing`).
