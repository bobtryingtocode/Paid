# 18 · Production architecture (running Paid as a real SaaS)

How to run Paid as a legitimate, compliant SaaS. The guiding constraints are the
ones that have shaped the whole codebase: **orchestration, not lending**
([`08`](08-compliance-notes.md)); **PII/audit-compliant, app is the system of
record** ([`15`](15-audit-trail-and-automation.md)); and **minimize regulated
surface** by leaning on Stripe + financing partners.

## Topology

```
                         ┌────────────────────────────────────────────┐
        Buyers / Sellers │                  Vercel                     │
        (browser, email) │   Next.js (App Router) — UI + API routes    │
              │          │   • SSR pages   • /api/* route handlers     │
              ▼          │   • server-only secrets (env)               │
        ┌───────────┐    └───┬───────────┬───────────┬───────────┬─────┘
        │  CDN/edge │◀───────┘           │           │           │
        └───────────┘     Prisma (pooled)│   server  │   server  │ webhooks in
                                         ▼           ▼           ▼
                                  ┌────────────┐ ┌────────┐ ┌──────────────┐
                                  │  Supabase  │ │ Stripe │ │  Anthropic   │
                                  │  Postgres  │ │ Connect│ │  (agent)     │
                                  │ (RLS, bkup)│ │+Billing│ └──────────────┘
                                  └────────────┘ └───┬────┘
                                                     ▼  payout (ACH)
                                              Seller's bank
        ┌─────────────────────────────────────────────────────────────┐
        │  Async: scheduled jobs (reconciliation, maturity true-up,     │
        │  usage-period rollover) + outbound Zapier (non-PII) events    │
        └─────────────────────────────────────────────────────────────┘
```

## Hosting & runtime

- **App:** Vercel (Next.js). API routes run on the Node.js runtime (set
  `export const runtime = "nodejs"` — already done where Prisma/Stripe/crypto are
  used). Pin a region close to the database.
- **Database:** Supabase Postgres. Prisma uses the **pooled** URL at runtime and
  the **direct** URL for migrations ([`12`](12-local-dev-and-demo.md)). Serverless
  functions × pooled connections → keep `connection_limit=1` on the pooled DSN
  and rely on Supavisor pooling.
- **Email:** Resend (or SES/Postmark) behind the `Mailer` seam ([`14`](14-bills-pdf-email.md)).
- **LLM:** Anthropic API via the platform key (metered per tenant — [`10`](10-metering-and-billing.md)).

## Environments

Three: **local** → **preview** (per-PR Vercel + a Supabase branch/separate test
project, all keys in **Stripe/Anthropic test mode**) → **production**. Never point
preview at prod data or live keys. Every env var in [`.env.example`](../.env.example)
is set per-environment in the host's secret store — nothing in the repo.

## Secrets & key management

- Store all secrets in Vercel env (encrypted) / a secrets manager — never in code.
  Only `NEXT_PUBLIC_*` reach the browser; partner keys must never use that prefix.
- Separate **test** vs **live** keys per environment. Rotate on exposure.
- Distinct webhook signing secrets per endpoint ([`16`](16-stripe-webhook-setup.md)):
  `STRIPE_WEBHOOK_SECRET` (Connect), `STRIPE_BILLING_WEBHOOK_SECRET` (platform),
  `WEBHOOK_SIGNING_SECRET` (outbound HMAC), `AUTH_SECRET` (sessions).

## Payments in production

- **Stripe Connect (Express)** for sellers — Stripe holds KYC + the payout bank;
  funds settle seller-direct as direct charges with a Cadence application fee.
  We never touch the money or store bank numbers.
- **Stripe Billing** for the seller's own subscription to Paid ([`10`](10-metering-and-billing.md)).
- **Webhooks** are the source of truth for money movement: signature-verified,
  idempotent (`WebhookEvent` unique on `(source, externalId)`), and the only path
  that flips a bill to funded / records the ledger + audit events. Configure both
  endpoints per [`16`](16-stripe-webhook-setup.md); enable `payout.paid` on the
  Connect endpoint.

## Background / scheduled work

Webhooks don't cover everything. Add scheduled jobs (Vercel Cron, or Supabase
`pg_cron`/Edge Functions) for:

- **Usage-period rollover** — open the next billing period; guard against stale
  capacity reads.
- **Model-C maturity true-up & reconciliation** — the maturity-date balloon and
  the periodic "derived balances == ledger" assertion ([`03`](03-ledger-and-sweep.md)).
- **Webhook/event retry sweeper** — re-emit outbound events that failed delivery.

Make every job **idempotent** and safe to re-run; record what it did to the audit
log.

## Data: integrity, privacy, backups

- **Integrity:** money is integer cents; the ledger and `AuditEvent` are
  append-only; reconciliation jobs assert balance. Enforce with DB constraints +
  the test suite ([`17`](17-testing-strategy.md)).
- **PII boundary:** customer PII lives only in app tables under access control;
  outbound (Zapier) events are non-PII by construction ([`15`](15-audit-trail-and-automation.md)).
  Consider Postgres **row-level security** so a tenant can only ever read its own
  rows, and column encryption for any sensitive field we do hold.
- **Backups & DR:** enable Supabase PITR (point-in-time recovery); document an
  RPO/RTO; test restore. Keep migrations in version control (`prisma migrate
  deploy` in the deploy step) — never edit prod schema by hand.

## Security & compliance

- **Minimized PCI scope:** card data never touches our servers — Stripe Checkout
  + Connect handle it (SAQ-A territory). Confirm with a QSA.
- **Auth hardening (prod):** the current Auth.js credentials baseline ([`11`](11-auth-and-billing-ui.md))
  should add email verification, password reset, sign-in rate limiting, and/or
  OAuth before launch. Set secure cookie flags; enforce HTTPS/HSTS.
- **Regulatory line:** keep Paid an orchestration layer (no holding/lending/term-
  setting). Have a fintech attorney confirm the Connect + financing-partner +
  reselling-the-agent structure per [`08`](08-compliance-notes.md).
- **App security:** input validation (zod on every route), authz/ownership checks
  (done on merchant routes), webhook signature verification, dependency scanning,
  least-privilege DB role.

## Observability

- **Error tracking** (e.g. Sentry) on client + server.
- **Structured logs** for every webhook and money-moving action, with the
  request id; never log secrets or PII.
- **Metrics/alerts:** webhook failure rate, payout failures, agent token spend vs
  capacity, reconciliation mismatches, 4xx/5xx, p95 latency.
- **Audit trail** ([`15`](15-audit-trail-and-automation.md)) is the business-level
  record; logs/metrics are the operational one.

## CI/CD

- CI today: `typecheck → test → smoke → build` on every PR. Add a Postgres
  service + integration tests ([`17`](17-testing-strategy.md)) and a security/dep
  scan.
- **Deploy:** Vercel preview per PR; promote to prod on merge to `main`. Run
  `prisma migrate deploy` as a release step (gated, with backups). Use Stripe
  **test mode** everywhere except prod.

## Scaling notes

- Stateless app → scales horizontally on Vercel. The bottleneck is Postgres
  connections (use pooling) and external rate limits (Stripe/Anthropic) — handle
  429s with backoff (the SDKs retry).
- The agent is the cost center; capacity metering + hard block ([`10`](10-metering-and-billing.md))
  protect margin. Consider a queue for long agent runs if volume grows.

## Launch checklist (abridged)

- [ ] Prod Supabase with PITR + tested restore; `migrate deploy` in release
- [ ] Live Stripe Connect + Billing; both webhook endpoints + secrets; `payout.paid` enabled
- [ ] Auth hardened (verification, reset, rate limit); secure cookies + HSTS
- [ ] Secrets in the host store, test/live split, rotation plan
- [ ] Scheduled jobs (rollover, maturity/reconciliation, retry sweeper) live + idempotent
- [ ] Error tracking + alerts on webhook/payout/reconciliation failures
- [ ] Fintech-attorney sign-off on the orchestration + reselling structure
- [ ] RLS / least-privilege DB; PII boundary verified; non-PII outbound confirmed
