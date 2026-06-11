# 19 · Deploying the prototype to Netlify

Paid is a Next.js app (SSR pages + API route handlers + Prisma + NextAuth +
Stripe). Netlify runs it via the **Next.js runtime** plugin; this repo is already
configured (`netlify.toml`, and the Prisma client builds the
`rhel-openssl-3.0.x` engine for Netlify's Lambda functions).

> This is a **prototype** deploy. For a real production setup (regions, backups,
> RLS, scheduled jobs, observability) see [`18`](18-production-architecture.md).

## Prerequisites

- A **Netlify** account.
- A **Supabase** Postgres DB (`DATABASE_URL` pooled + `DIRECT_URL` direct — see
  [`12`](12-local-dev-and-demo.md)).
- **Stripe** keys (test mode is fine for a prototype) and the webhook secrets.
- `ANTHROPIC_API_KEY` if you want the invoice agent to run.

## Option A — Git-connected (recommended)

1. Push this branch to GitHub (already done).
2. Netlify → **Add new site → Import from Git** → pick the repo/branch. Netlify
   reads `netlify.toml` (build command `prisma generate && next build`, Node 22,
   the Next.js plugin) automatically.
3. **Site settings → Environment variables** — add the values from
   [`.env.example`](../.env.example) (see the list below).
4. **Deploy**. Every push to the connected branch redeploys.

## Option B — Netlify CLI

```bash
npm i -g netlify-cli
netlify login
netlify init            # or: netlify link  (to an existing site)

# set env vars (or do it in the UI) — repeat per key:
netlify env:set AUTH_SECRET "$(openssl rand -base64 32)"
netlify env:set DATABASE_URL "postgresql://...:6543/postgres?pgbouncer=true&connection_limit=1"
netlify env:set DIRECT_URL   "postgresql://...:5432/postgres"
# ...the rest below...

netlify deploy --build --prod
```

## Required environment variables

| Var | Notes |
|-----|-------|
| `DATABASE_URL` / `DIRECT_URL` | Supabase pooled + direct |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | your Netlify URL, e.g. `https://paid.netlify.app` |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | payments + Connect webhook |
| `STRIPE_BILLING_WEBHOOK_SECRET` | subscriptions webhook |
| `STRIPE_PRICE_STARTER` / `_PRO` / `_SCALE` | plan price ids |
| `ANTHROPIC_API_KEY` | invoice agent (optional) |
| `RESEND_API_KEY` / `EMAIL_FROM` | bill email (optional; stub without) |
| `ZAPIER_WEBHOOK_URL` / `WEBHOOK_SIGNING_SECRET` | outbound automation (optional) |

## Database migration (run once per env)

Migrations are **not** run in the Netlify build (build shouldn't depend on a live
DB). Apply them against the prod DB from your machine or CI:

```bash
DATABASE_URL=... DIRECT_URL=... npx prisma migrate deploy
# optional one-time demo data (skip for real production):
# DATABASE_URL=... DIRECT_URL=... npm run db:seed
```

## Post-deploy

1. Set `NEXT_PUBLIC_APP_URL` to the live URL and redeploy.
2. Point the Stripe webhook endpoints at the Netlify URL and paste the signing
   secrets in — both endpoints, including `payout.paid` on the Connect one (see
   [`16`](16-stripe-webhook-setup.md)).
3. Sign up, complete Stripe Connect onboarding, set payment offerings, send a
   test bill, and open the `/pay/<token>` page.

## The agent endpoint — async on Netlify

`/api/agent/p2p` runs a multi-turn Claude loop, which exceeds Netlify's
**synchronous** function cap (≈10–26s). On Netlify the agent therefore runs as a
**Background Function** (up to 15 min):

```
client → POST /api/agent/p2p/async        auth + capacity pre-check (fast 402)
            └─▶ invokes /.netlify/functions/agent-run-background
                (internal AUTH_SECRET bearer; platform acks 202 and keeps running)
                  └─▶ executeAgentRun(...) → result written to Netlify Blobs
client → GET /api/agent/p2p/jobs/:id      polls until done / error (ownership-checked)
```

The `/agent` page tries the async path first and **falls back to the sync route**
when it gets 501 (i.e. running locally or on a non-Netlify host). Job records
live in Netlify Blobs (store `agent-jobs`); the background function is bundled
from `netlify/functions/agent-run-background.mts` with the Prisma engine via
`included_files` in `netlify.toml`. A direct unauthorized POST to the background
function still gets the platform's 202 ack — that's how background functions
respond — but the body verifies the internal bearer and does nothing without it.

Everything else (auth, bills, buyer checkout, billing, webhooks, transactions)
fits comfortably within the normal function limits.
