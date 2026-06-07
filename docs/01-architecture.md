# 01 · System architecture

## Guiding principle

Cadence is an **orchestration layer**. Money flows
`partner → Stripe → merchant`; it never rests in a Cadence-controlled account.
The backend's job is to coordinate partners, present the right checkout, and
keep an authoritative ledger — not to hold, lend, or move funds on its own
account. Keep this in mind whenever a design choice would put Cadence in the
custody or credit path.

## High-level component map

```
                         ┌─────────────────────────────┐
                         │          CLIENTS            │
                         │  Web (Next.js)   iOS (RN)*  │   *Phase 2
                         │  - merchant dashboard       │
                         │  - hosted payer pages       │
                         └──────────────┬──────────────┘
                                        │ HTTPS (no secrets in client)
                                        ▼
                         ┌─────────────────────────────┐
                         │      CADENCE BACKEND        │
                         │  Next.js route handlers     │
                         │  + server-only services     │
                         │                             │
                         │  • Auth & merchant accounts │
                         │  • Payment-link / invoice   │
                         │  • Orchestration services   │
                         │  • LEDGER (system of record)│
                         │  • Webhook processors       │
                         │  • Notifications            │
                         └───┬───────────┬───────────┬─┘
                             │           │           │
              secret keys ── │           │           │ ── webhooks in
                             ▼           ▼           ▼
                  ┌────────────┐  ┌────────────┐  ┌──────────────────┐
                  │   Stripe   │  │  BNPL via  │  │ Embedded-capital │
                  │  Connect   │  │  Stripe    │  │ & B2B partners   │
                  │  (rails)   │  │ Klarna/    │  │ Resolve,         │
                  │            │  │ Affirm     │  │ Kickfurther…     │
                  └─────┬──────┘  └────────────┘  └──────────────────┘
                        │
                        ▼
                  ┌────────────┐
                  │  Merchant  │  funded today (next-day payout)
                  │  bank acct │
                  └────────────┘

                  ┌─────────────────────────────┐
                  │        PostgreSQL           │
                  │  (Prisma) — ledger, links,  │
                  │  merchants, deals, events   │
                  └─────────────────────────────┘
```

## Trust boundaries

1. **Client ↔ Backend.** The client never holds partner secret keys, never
   talks to a partner directly, and never computes authoritative balances.
   Clients call the Cadence backend; the backend calls partners. The ledger is
   read by clients, written only by the backend.
2. **Backend ↔ Partners.** All secret keys (Stripe secret key, partner API
   keys, webhook signing secrets) live in server-side environment/secret
   storage. Every inbound webhook is signature-verified before it is trusted.
3. **Backend ↔ Database.** The database is the system of record. Every money
   movement reported by a partner is recorded as an immutable ledger event;
   balances are derived from events, not edited in place. See
   [`03-ledger-and-sweep.md`](03-ledger-and-sweep.md).

## Core backend services

| Service | Responsibility |
|---------|----------------|
| **Identity & accounts** | Merchant signup, auth, Stripe Connect account onboarding/KYC handoff. |
| **Payment links / invoices** | Create and host a request the payer can open and act on. |
| **Checkout orchestration** | Decide which model/partner applies, build the right Stripe Checkout / partner approval flow. |
| **Funding orchestration** | Track partner approval → funding → merchant payout for a given deal. |
| **Ledger** | Append-only event store + derived balances; the single source of truth. |
| **Webhook intake** | Verify + ingest Stripe and partner webhooks; translate into ledger events. |
| **Sweep engine (Model C)** | On each sale, compute and execute the "% off the top" via Stripe; track cap, run maturity true-up. |
| **Notifications** | Links, receipts, schedules, reminders via email/SMS. |

## Chosen stack & why

| Layer | Choice | Why |
|-------|--------|-----|
| Web + API | **Next.js (App Router) + TypeScript** | One shared codebase for web UI and API route handlers; clean server-only boundary (`server` components / route handlers) for secrets and partner calls; the brief explicitly allows one shared codebase to start. |
| Native iOS (Phase 2) | **React Native / Expo** | Reuses the TypeScript domain core (ledger math, validation, types) and talks to the same backend API. |
| Database | **PostgreSQL** | Relational integrity for a financial ledger; transactions, constraints, decimal money types. |
| ORM | **Prisma** | Typed schema shared with the TypeScript app; migrations as code. See [`04-data-model.md`](04-data-model.md). |
| Money rails | **Stripe Connect** | Routes funds to merchants, presents Klarna/Affirm at checkout, and enables the automatic per-sale sweep (application fees / transfers) in Model C. |
| Notifications | Email + SMS provider (e.g. Resend/Postmark + Twilio) | Links, receipts, reminders. Provider is interchangeable behind a `Notifier` interface. |

### Swap-out notes

The architecture is partner- and provider-agnostic behind interfaces:

- **`PartnerAdapter`** — one per financing partner (Klarna/Affirm-via-Stripe,
  Resolve, embedded-capital). Adding a partner means implementing approval,
  funding, and webhook-mapping for that adapter; nothing else changes.
- **`Notifier`** — email/SMS provider behind a single interface.
- **Stripe** is assumed as the rails, but the money-movement calls are isolated
  in a `Rails` service so the rest of the system depends on ledger events, not
  Stripe specifics.

## Money & precision conventions

- Store money as **integer minor units** (cents) in a dedicated column type, or
  Postgres `NUMERIC`, never floating point.
- All rates (factor, sweep rate) stored as exact decimals/basis points.
- Every balance shown to a user is **derived from ledger events** at read time
  (or from a maintained materialized balance that is reconciled against events).

## Environments & secrets

- `.env` (local), platform secret store (deploy). Required secrets sketched in
  [`06-partner-integrations.md`](06-partner-integrations.md).
- No secret ever ships to the client bundle. Next.js: only `NEXT_PUBLIC_*` vars
  are client-visible — partner keys must never use that prefix.
