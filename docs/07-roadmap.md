# 07 · Build roadmap

The sequence is **one model, one niche, then expand.** Each phase has a single
goal and ships something real before the next begins.

## Phase 0 — Validate (no code)

**Goal:** confirm shops want this before spending real money.

- [ ] Show the clickable prototype to 15–20 local shop owners.
- [ ] Get a partner's standard merchant terms in writing.
- [ ] Pick **ONE** model (A is simplest) and **ONE** niche to launch into.

No application code. Output is signal + a signed partner term sheet + a chosen
niche.

## Phase 1 — MVP, Model A only

**Goal:** one shop, real money, real payout.

- [ ] Web app + Stripe Connect + Klarna/Affirm at checkout.
- [ ] Merchant creates a link → customer pays over time → merchant funded next
      day.
- [ ] Basic ledger + receipts.
- [ ] **No iOS app yet** (web works on phones).

Maps to: [`05-api-design.md`](05-api-design.md) auth + payment-link + public
payer endpoints; [`06-partner-integrations.md`](06-partner-integrations.md)
Stripe + BNPL-via-Stripe; [`04-data-model.md`](04-data-model.md) `Merchant`,
`PaymentLink`, `Transaction`, `LedgerEvent`.

## Phase 2 — Add B2B (Model B) + native iOS

**Goal:** serve small-biz-to-small-biz and feel like a real app.

- [ ] Resolve Pay integration for Net 30/60/90.
- [ ] Native iOS app; merchant dashboard with history & payout tracking.

Maps to: the `RESOLVE` adapter; React Native client reusing the TypeScript core.

## Phase 3 — The make-and-sell engine (Model C)

**Goal:** the differentiated product — pay the maker, repay from sales.

- [ ] Embedded-capital partner pays manufacturer/3PL upfront.
- [ ] Automatic % sweep off each sale via Stripe; live balance ledger.
- [ ] Maturity true-up logic + early-payoff rebate.

Maps to: [`03-ledger-and-sweep.md`](03-ledger-and-sweep.md) in full; `Deal`,
`Sale`, sweep engine, maturity job; the `EMBEDDED_CAPITAL` adapter.

---

## Out of scope for v1 (resist these)

- **Building your own underwriting / credit model** — the partner does this.
- **Holding customer funds in your own account** — money flows
  `partner → Stripe → merchant`.
- **Supporting every model and every niche at once** — one model, one niche,
  then expand.

These are not "later features"; they are the guardrails that keep Noctua Pay an
orchestration layer and out of regulated-lender territory. See
[`08-compliance-notes.md`](08-compliance-notes.md).

## Definition of done per phase

| Phase | Done when… |
|-------|-----------|
| 0 | A niche + model is chosen and a partner term sheet is in writing. |
| 1 | A real shop creates a link, a real customer pays over time, and the shop is funded next day, with the ledger reflecting it. |
| 2 | A B2B invoice funds via Resolve and the merchant manages it from a native iOS app. |
| 3 | A financed deal sweeps automatically per sale, stops at the cap, and runs a correct balloon true-up at maturity. |
