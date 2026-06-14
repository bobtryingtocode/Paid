# 15 · Audit trail, transaction journey & Zapier automation

The transactional workflow is **PII- and audit-compliant**: the app + Supabase is
the system of record; **Zapier is glue**, not the orchestrator. PII stays inside
our boundary; only **non-PII events** are emitted outward for automation.

## Why this shape (not "run it through Zapier")

Passing customer PII (name, email, bank/deposit, identity-linked amounts) through
a third-party automation platform stores it in that platform's task logs and
breaks PII compliance. So:

- **System of record + PII + reconciliation** live in the app/DB (access-controlled).
- **Outbound events are non-PII** — ids, type, actor, amount, currency, status —
  and are what Zapier consumes.

## Audit log (system of record)

`AuditEvent` (append-only) records each stage of the journey, keyed to the
merchant and the transaction (`PaymentLink`). `detail` is **non-PII only**.

Event types (`src/audit/events.ts`):

| Type | Emitted when | Actor |
|------|--------------|-------|
| `bill.created` | merchant creates a bill | merchant |
| `bill.emailed` | bill PDF emailed to the customer (no email address stored) | merchant |
| `payment.approved` | Stripe confirms payment/funding | stripe |
| `transaction.reconciled` | funding recorded to the ledger | system |
| `payout.paid` | Stripe payout settled to the seller's bank | stripe |

`recordEvent()` (`src/audit/log.ts`) writes the row (authoritative) **and** emits
the outbound webhook (best-effort).

## Outbound webhook → Zapier

`emitEvent()` (`src/audit/webhook.ts`) POSTs the non-PII payload to
`ZAPIER_WEBHOOK_URL` (a Zapier "Catch Hook" trigger), HMAC-signed with
`WEBHOOK_SIGNING_SECRET` in the `x-noctua-signature` header so the consumer can
verify it. Unset URL → stub (logs); failures are caught and never break the
payment flow. Payload shape (`buildEventPayload`):

```json
{ "id": "...", "type": "payment.approved", "actor": "stripe",
  "merchantId": "...", "paymentLinkId": "...", "amountCents": 25000,
  "currency": "usd", "detail": { }, "createdAt": "2026-..." }
```

In Zapier: **Catch Hook** trigger → your actions (notify the merchant, append to a
Sheet, post to Slack, etc.). No PII leaves Noctua Pay.

## Transaction journey (merchant portal)

- `/transactions` — the merchant's transactions with status.
- `/transactions/[id]` — the **audit-compliant timeline** for one transaction
  (every event, timestamped, with actor), plus the **deposit destination** —
  bank name + last4 from the seller's Stripe Connect account
  (`getPayoutDestination`). Stripe holds the account/routing; we never store them.

## Configuration

| Env | Purpose |
|-----|---------|
| `ZAPIER_WEBHOOK_URL` | Zapier Catch Hook URL; unset → stub mode |
| `WEBHOOK_SIGNING_SECRET` | HMAC secret for `x-noctua-signature` |

## Status & guardrails

- `AuditEvent` is append-only — corrections are new events, never edits.
- `detail` must stay non-PII; the test in `tests/audit-events.test.ts` guards the
  payload shape against PII field names.
- To receive `payout.paid`, enable that event on your **Connect** Stripe webhook
  endpoint (the handler maps `event.account` → merchant). Full setup:
  [`16-stripe-webhook-setup.md`](16-stripe-webhook-setup.md).
