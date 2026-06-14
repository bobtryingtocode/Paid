# 19 · Deploying the app to Vercel

Noctua Pay is a Next.js app (SSR pages + API route handlers + Prisma + NextAuth +
Stripe). Vercel runs it natively via its **Next.js** framework preset; this repo
is configured with [`vercel.json`](../vercel.json), and the Prisma client builds
the `rhel-openssl-3.0.x` engine for Vercel's Lambda runtime (`postinstall`
runs `prisma generate`).

> For a real production setup (regions, backups, RLS, scheduled jobs,
> observability) see [`18`](18-production-architecture.md).

## Prerequisites

- A **Vercel** account.
- A **Supabase** Postgres DB (`DATABASE_URL` pooled + `DIRECT_URL` direct — see
  [`12`](12-local-dev-and-demo.md)).
- **Stripe** keys (test mode is fine for a prototype) and the webhook secrets.
- `ANTHROPIC_API_KEY` if you want the invoice agent to run.

## Option A — Git-connected (recommended)

1. Push this branch to GitHub (already done).
2. Vercel → **Add New… → Project → Import** the repo. Vercel detects Next.js;
   the default build command (`next build`) and install (`npm install`, which
   runs `prisma generate` via `postinstall`) are correct.
3. **Project Settings → Environment Variables** — add the values from
   [`.env.example`](../.env.example) (see the list below).
4. **Deploy**. Every push to the connected branch creates a Preview deploy; the
   production branch promotes to Production.

## Option B — Vercel CLI

```bash
npm i -g vercel
vercel login
vercel link             # or `vercel` to create a new project

# set env vars (or do it in the UI) — repeat per key/environment:
vercel env add AUTH_SECRET production
vercel env add DATABASE_URL production
vercel env add DIRECT_URL production
# ...the rest below...

vercel --prod
```

## Required environment variables

| Var | Notes |
|-----|-------|
| `DATABASE_URL` / `DIRECT_URL` | Supabase pooled + direct |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | your Vercel URL, e.g. `https://noctua-pay.vercel.app` |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | payments + Connect webhook |
| `STRIPE_BILLING_WEBHOOK_SECRET` | subscriptions webhook |
| `STRIPE_PRICE_STARTER` / `_PRO` / `_SCALE` | plan price ids |
| `ANTHROPIC_API_KEY` | invoice agent (optional) |
| `RESEND_API_KEY` / `EMAIL_FROM` | bill email (optional; stub without) |
| `ZAPIER_WEBHOOK_URL` / `WEBHOOK_SIGNING_SECRET` | outbound automation (optional) |

## Database migration (run once per env)

Migrations are **not** run in the Vercel build (the build shouldn't depend on a
live DB). Apply them against the prod DB from your machine or CI:

```bash
DATABASE_URL=... DIRECT_URL=... npx prisma migrate deploy
# optional one-time demo data (skip for real production):
# DATABASE_URL=... DIRECT_URL=... npm run db:seed
```

The async agent uses the `AgentJob` table — make sure the migration that adds it
has been applied before exercising `/agent` in production.

## Post-deploy

1. Set `NEXT_PUBLIC_APP_URL` to the live URL and redeploy.
2. Point the Stripe webhook endpoints at the Vercel URL and paste the signing
   secrets in — both endpoints, including `payout.paid` on the Connect one (see
   [`16`](16-stripe-webhook-setup.md)).
3. Sign up, complete Stripe Connect onboarding, set payment offerings, send a
   test bill, and open the `/pay/<token>` page.

## The agent endpoint — async without a separate background service

`/api/agent/p2p` runs a multi-turn Claude loop, which can exceed a short
synchronous function budget. The async path keeps the request fast and does the
long work **after the response is sent**, using Next.js
[`after`](https://nextjs.org/docs/app/api-reference/functions/after) on the Node
runtime — no separate Netlify Background Function or worker service:

```
client → POST /api/agent/p2p/async        auth + capacity pre-check (fast 402)
            └─▶ inserts a RUNNING AgentJob row, returns 202 + jobId
            └─▶ after(): executeAgentRun(...) → writes result/error to the row
client → GET /api/agent/p2p/jobs/:id       polls until done / error (ownership-checked)
```

Job records live in Postgres (the `AgentJob` table) via Prisma, so async runs
work on any host (local dev included) — there is no host-specific blob store. The
enqueue route sets `maxDuration = 300` so the post-response work has the full
budget; this requires a Vercel plan that allows long functions (Pro is 300s). The
`/agent` page still falls back to the synchronous route if the async route is
unavailable.

Everything else (auth, bills, buyer checkout, billing, webhooks, transactions)
fits comfortably within the normal function limits.
