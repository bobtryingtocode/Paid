# 00 · Product overview

## Product, in one line

A payment-link app (iOS + web) that lets small businesses get paid in full
today while their customer — or their own buyer, or their inventory itself —
pays over time, with the financing partner carrying the risk.

## Who uses it

- **The shop / supplier / brand** — creates a request or invoice, gets funded
  up front, never chases money.
- **The payer** — a consumer, a business buyer, or (in the inventory model) the
  business itself, repaying out of sales.

## Positioning — who this is for

**The hero use case is small-business → consumer (B2C).** A customer who would
otherwise just tap a credit card is instead offered a **Klarna pay-over-time
plan** at checkout. The crucial difference from a plain card charge:

- The business is **paid in full today**; Klarna carries the repayment risk
  (non-recourse).
- It's a **checkout choice, not a financing application** — the shop needs **no
  new bank or lender relationship** and no internal credit process. Turn it on
  and offer it like any other payment method.
- For the consumer it lowers the barrier to buy (Pay-in-4 / monthly), which tends
  to lift conversion and basket size versus card-only.

This is **Model A**, and it's the wedge: the everyday B2C product or service that
a consumer normally pays for by card.

**B2B is the heavier, bank/lender-style path — secondary.** When the payer is
another business, its internal procurement / accounts-payable processes usually
require **net terms or a lender-style arrangement** rather than a consumer BNPL
button. That's **Model B** (Net 30/60/90) and **Model C** (make-&-sell inventory
financing) — more setup, larger tickets, slower cycles. Lead with the B2C/Klarna
wedge; reach for the bank/lender path when a business buyer's process demands it.

## The one decision that changes everything

> **Do not become the lender or the money-mover.**

Holding the money, lending it, or setting the credit terms turns Cadence into a
regulated bank / money-transmitter — licensing in all 50 states, huge capital
and compliance burden.

Instead, build the **experience and the orchestration layer only**. Plug into
embedded-capital and BNPL partners who hold:

- the **license**,
- the **capital**,
- the **underwriting**, and
- the **risk**.

Cadence earns a **share of the partner's fee**. This is the difference between a
6-month build and a multi-year regulated-entity slog. Every architectural choice
in these docs exists to preserve this line. See
[`08-compliance-notes.md`](08-compliance-notes.md).

## What the developer actually builds (plain English)

1. **An app for iOS and desktop/web** — one shared codebase is fine to start.
2. **A secure server ("the backend")** that holds the secret keys and talks to
   the partners. The keys never live in the app itself.
3. **Stripe as the rails** — using Stripe Connect to route money and to present
   Klarna/Affirm at checkout, and to do the automatic "skim off each sale" in
   Model C.
4. **Connections to the financing partners' APIs** (Resolve, an embedded-capital
   provider, etc.) for approvals and funding.
5. **A ledger** — the system of record. The single source of truth for who owes
   what, how much has been swept, and what's left. This is the heart of the app,
   especially for Model C.
6. **Notifications** — texts/emails with the payment link, receipts, schedules,
   reminders.

## Out of scope for v1 (resist these)

- Building your own **underwriting / credit model** — the partner does this.
- Holding customer funds in your **own account** — money flows
  `partner → Stripe → merchant`.
- Supporting **every model and every niche** at once. One model, one niche, then
  expand.

## How to read these docs

| If you want… | Read |
|--------------|------|
| The why and the guardrails | this file + [`08-compliance-notes.md`](08-compliance-notes.md) |
| The system shape and stack | [`01-architecture.md`](01-architecture.md) |
| How each money model flows | [`02-money-models.md`](02-money-models.md) |
| The ledger + Model C math | [`03-ledger-and-sweep.md`](03-ledger-and-sweep.md) |
| Tables / schema | [`04-data-model.md`](04-data-model.md) |
| Endpoints | [`05-api-design.md`](05-api-design.md) |
| Partner APIs | [`06-partner-integrations.md`](06-partner-integrations.md) |
| What to build, in what order | [`07-roadmap.md`](07-roadmap.md) |
