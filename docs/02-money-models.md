# 02 · The three money-flow models

All three models share one property: **the party that needs cash gets it in
full now, and a financing partner waits to collect.** Cadence orchestrates;
the partner carries the risk.

| Model | Who gets paid now | Who repays, how | Best-fit partner |
|-------|-------------------|------------------|------------------|
| **A · Consumer** | The shop, in full today | Consumer, in installments (Pay-in-4 or monthly) | Klarna / Affirm via Stripe |
| **B · B2B terms** | The supplier, in full today | Business buyer, on Net 30 / 60 / 90 | Resolve Pay |
| **C · Make & sell** | The manufacturer / 3PL, upfront | The business, as a % off each sale + balloon at maturity | Kickfurther / Wayflyer / Parafin |

---

## Models A & B — "paid now" (the simple flow)

A consumer or a business buyer chooses to pay over time. The shop is funded in
full today; the partner waits and collects. **Identical plumbing** — only the
partner and the repayment calendar differ.

```
        PAYER                 RAILS                    TODAY
   Customer / Buyer  ──▶  Stripe + Partner   ──▶   Shop / Supplier
   picks a plan           approves & funds          funded next day
                          pays merchant in full
```

> Separately and later: the partner collects from the payer over weeks
> (Model A) or 30–90 days (Model B). **If the payer never pays, that's the
> partner's loss — non-recourse.**

### Model A — Consumer installments

- Payer is a **consumer** at checkout.
- Cadence presents **Klarna / Affirm through Stripe** as the pay-over-time
  option.
- Partner approves the consumer and pays the merchant in full; merchant sees a
  next-day payout.
- Repayment calendar: Pay-in-4 or monthly, handled entirely by the partner.
- This is the **simplest model and the recommended MVP** (see
  [`07-roadmap.md`](07-roadmap.md)).

### Model B — B2B net terms

- Payer is a **business buyer**; the instrument is an invoice with Net 30/60/90
  terms.
- Cadence integrates **Resolve Pay**: the buyer is approved for terms, the
  supplier is paid in full now, Resolve collects on the due date.
- Same "paid now, partner collects later, non-recourse" shape as Model A —
  different partner and a longer, date-based calendar instead of consumer
  installments.

### What Cadence does for A & B

1. Merchant creates a payment link / invoice.
2. Payer opens it and chooses pay-over-time.
3. Cadence routes to the partner (via Stripe for A; Resolve for B), which
   approves and funds.
4. Merchant is paid in full; Cadence records the funding as a ledger event and
   sends receipts.
5. Collection from the payer is the partner's job; Cadence may surface status
   but is **not** in the collection path.

---

## Model C — make & sell (the differentiated structure)

A financer pays the **contract manufacturer or 3PL upfront** so
production/fulfilment happens with **no cash out of the business**. The business
then repays automatically as a **slice off the top of each sale**, with a
**hard final date** that backstops the financer.

```
        DAY 0                      THEN                  EACH SALE              SET DATE
  Financer pays maker   ──▶  Goods made / stocked  ──▶  % swept off    ──▶  Balloon true-up
  100% of production /        business sells as          the top via         any unpaid
  3PL cost, direct to        normal                      Stripe, until       remainder due
  the manufacturer                                       the cap is repaid   in one payment
```

### Why this model is the heart of the product

- It is the structure the founder designed and the one that differentiates
  Cadence from generic BNPL.
- It depends entirely on the **ledger** and the **automatic Stripe sweep** —
  the parts that are hardest to fake and most valuable to get right.
- The detailed terms, sweep math, worked example, and enforceability are in
  [`03-ledger-and-sweep.md`](03-ledger-and-sweep.md).

### What Cadence does for C

1. A deal is struck: advance, fee/factor (→ repayment cap), sweep rate,
   maturity date, optional early-payoff rebate.
2. Financer pays the maker/3PL on day 0 (Cadence records the advance; it does
   not move this money itself).
3. Goods are produced/stocked; the business sells through the Cadence-connected
   Stripe account.
4. On **each sale**, the sweep engine pulls the agreed % off the top to the
   financer and records swept-to-date and remaining balance.
5. Sweeps **stop automatically** when the cap is cleared (early-payoff rebate
   may apply).
6. At the **maturity date**, any remaining balance is billed as a single
   balloon true-up.

---

## Common thread

| | Model A | Model B | Model C |
|---|---------|---------|---------|
| Paid now | Shop | Supplier | Manufacturer / 3PL |
| Payer | Consumer | Business buyer | The business, out of sales |
| Repayment | Installments | Net 30/60/90 | % sweep + balloon |
| Risk holder | BNPL partner | Resolve | Embedded-capital financer |
| Cadence role | Orchestrate + ledger | Orchestrate + ledger | Orchestrate + **sweep + ledger** |
| Recourse | Non-recourse (partner) | Non-recourse (partner) | Collateralized (inventory/UCC + often PG) |
