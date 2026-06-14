# 16 · Stripe webhook setup

Noctua Pay has **two** Stripe webhook endpoints with **separate signing secrets**.
Configure both in the Stripe Dashboard (or forward them locally with the Stripe
CLI). Each endpoint verifies its signature and ingests events idempotently.

| Endpoint | Scope | Events | Secret |
|----------|-------|--------|--------|
| `POST /api/webhooks/stripe` | **Connect** (events on connected accounts) | `checkout.session.completed`, `payment_intent.succeeded`, `payout.paid` | `STRIPE_WEBHOOK_SECRET` |
| `POST /api/webhooks/stripe-billing` | **Platform** (your account) | `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` | `STRIPE_BILLING_WEBHOOK_SECRET` |

## 1. Payments & payouts — Connect endpoint

Buyer charges run as **direct charges on the seller's connected account**, and
payouts settle to the seller's bank — so these events originate on connected
accounts. The endpoint must **listen to events on connected accounts** (a Connect
webhook); `event.account` is then the connected account id.

Enable these events:

- **`checkout.session.completed`** / **`payment_intent.succeeded`** → records
  funding to the ledger and emits `payment.approved` + `transaction.reconciled`
  (mapped to the bill via `client_reference_id` / `metadata.linkToken`).
- **`payout.paid`** → emits the `payout.paid` audit/journey event. The handler
  maps `event.account` → the merchant (`stripeAccountId`), so **this only works on
  the Connect endpoint** (a platform-only webhook has no `event.account`).

**Dashboard:** Developers → Webhooks → **Add endpoint** → URL
`https://<your-domain>/api/webhooks/stripe` → under "Listen to events on" choose
**Connected accounts** → select the three events above → copy the signing secret
into `STRIPE_WEBHOOK_SECRET`.

## 2. Subscriptions — platform endpoint

Merchant subscriptions to **Noctua Pay's own plans** ([`10`](10-metering-and-billing.md))
are on your platform account (not connected). Add a separate endpoint
`https://<your-domain>/api/webhooks/stripe-billing` (default "Events on your
account"), select the `checkout.session.completed` and `customer.subscription.*`
events, and copy its secret into `STRIPE_BILLING_WEBHOOK_SECRET`.

> Use **distinct** endpoints/secrets so a Connect payment event and a platform
> subscription event are verified against the right secret.

## Local development (Stripe CLI)

```bash
# Platform events → billing endpoint
stripe listen --forward-to localhost:3000/api/webhooks/stripe-billing \
  --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted

# Connected-account events (payments + payouts) → Connect endpoint
stripe listen --forward-connect-to localhost:3000/api/webhooks/stripe \
  --events checkout.session.completed,payment_intent.succeeded,payout.paid
```

Each `stripe listen` prints a `whsec_…` secret — put the platform one in
`STRIPE_BILLING_WEBHOOK_SECRET` and the Connect one in `STRIPE_WEBHOOK_SECRET`.

Trigger a payout event to test the journey:

```bash
stripe trigger payout.paid
```

## Intake guarantees

Both handlers: **verify signature → persist the raw event idempotently**
(`WebhookEvent`, unique on `(source, externalId)`) **→ translate → ack**. A
duplicate delivery is a no-op. See [`06`](06-partner-integrations.md) and
[`15`](15-audit-trail-and-automation.md).
