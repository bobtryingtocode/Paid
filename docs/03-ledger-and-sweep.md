# 03 · The ledger & the Model C sweep

The ledger is the **system of record** — the single source of truth for who owes
what, how much has been swept, and what's left. This is the heart of the app,
especially for Model C. This document specifies the Model C terms, the sweep
mechanics, and the math, then states what makes the structure enforceable.

## The five terms a developer & partner must agree on

| Term | What it is | Typical range |
|------|------------|---------------|
| **Advance** | Cash paid to the maker/3PL on day 0 | Up to 100% of the production cost |
| **Fee / factor** | The financer's margin; sets the total repayment cap | 1.10×–1.50× of the advance |
| **Sweep rate** | The "% off the top" pulled from each sale | ~2%–50% of gross, sized to expected sell-through |
| **Maturity date** | The "set date" — when any remaining balance is due in full | 6–12 months |
| **Early-payoff rebate** | Fee reduction if the cap is hit early (fairness lever) | Optional, recommended |

Derived quantities:

- **Repayment cap** = `advance × factor`.
- **Financer margin** = `cap − advance`.
- **Swept to date** = sum of all sweep ledger events for the deal.
- **Balance left** = `cap − swept_to_date` (floored at 0).
- **Balloon at maturity** = `balance_left` on the maturity date (0 if already
  cleared).

## Sweep mechanics (per sale)

On each sale that runs through the Noctua Pay-connected Stripe account:

1. Compute `sweep = round(gross_sale × sweep_rate)`.
2. If `swept_to_date + sweep > cap`, clamp so the final sweep exactly clears the
   cap: `sweep = cap − swept_to_date`.
3. Move `sweep` to the financer via Stripe (application fee / transfer); the
   business keeps `gross_sale − sweep`.
4. Append a **sweep ledger event** (sale id, gross, sweep, new swept-to-date,
   new balance).
5. When `balance_left == 0`, **stop sweeping**; subsequent sales are kept 100%
   by the business. Apply early-payoff rebate if configured.

Rounding rule: work in integer minor units (cents); round each per-sale sweep
to the nearest cent; the clamp in step 2 guarantees totals reconcile exactly to
the cap with no drift.

## Worked example

| | |
|---|---|
| **Advance to maker (day 0)** | **$100,000** — paid directly to the contract manufacturer |
| **Repayment cap (1.15× factor)** | **$115,000** — financer's margin = $15,000 |
| **Sweep rate off each sale** | **40%** — business keeps 60% to run on |
| **Maturity (balloon) date** | **9 months** — remainder due if not yet repaid |

### How the ledger moves — per $1,000 of sales

| Gross sales to date | Swept to financer (40%) | Business keeps | Balance left on $115K cap |
|---------------------|--------------------------|----------------|----------------------------|
| $25,000 | $10,000 | $15,000 | $105,000 |
| $100,000 | $40,000 | $60,000 | $75,000 |
| $200,000 | $80,000 | $120,000 | $35,000 |
| $287,500 | $115,000 | $172,500 | **$0 — done, sweeps stop** |

- **Strong sales:** the cap clears before month 9 and the business keeps 100%
  from then on (at `$287,500` of gross sales, `40% = $115,000 = cap`).
- **Slow sales:** say only `$96,000` was swept by the maturity date — the
  balloon true-up is `$115,000 − $96,000 = $19,000`, due in one payment.

Slow months never trigger a fixed bill mid-stream; that's the **"not held
hostage"** property. The balloon is what makes a financer willing to fund it.

## Reference math (illustrative, TypeScript)

> Pseudocode for the spec — not committed app code. All values in integer cents.

```ts
type DealTerms = {
  advanceCents: number;      // day-0 cash to maker
  factor: number;            // e.g. 1.15
  sweepRateBps: number;      // e.g. 4000 = 40.00%
  maturityDate: Date;
};

const capCents = (t: DealTerms) => Math.round(t.advanceCents * t.factor);

/** Compute the sweep for one sale, clamped so it never overshoots the cap. */
function sweepForSale(grossCents: number, sweptToDateCents: number, t: DealTerms) {
  const cap = capCents(t);
  if (sweptToDateCents >= cap) return 0;            // cap cleared → keep 100%
  const raw = Math.round(grossCents * t.sweepRateBps / 10_000);
  return Math.min(raw, cap - sweptToDateCents);     // clamp final sweep
}

const balanceLeftCents = (sweptToDateCents: number, t: DealTerms) =>
  Math.max(0, capCents(t) - sweptToDateCents);

/** At maturity, any remaining balance is due in one payment. */
const balloonCents = (sweptToDateCents: number, t: DealTerms) =>
  balanceLeftCents(sweptToDateCents, t);
```

## What makes it enforceable (the part that protects the financer)

- **Sales must run through the platform.** The Stripe connection is what lets
  the sweep happen automatically and can't be quietly bypassed. **This is the
  core control — and the core leakage risk** if a business sells off-platform.
- **The inventory is the collateral.** If things go wrong, the financed goods
  back the advance (a **UCC lien**), often plus a **personal guarantee** for a
  small business.
- **The platform is the system of record** for units sold and dollars swept, so
  reconciliation between business, financer, and maker is **automatic**.

### Why this beats a normal loan for the small business

No cash out the door to make the product. Repayment **flexes with actual sales**
instead of a fixed monthly payment. It's **non-dilutive** — no equity given up.
And there's one clear, known number to clear by one known date. That
combination — variable when you're slow, capped and dated for the financer — is
the whole reason this structure exists.

## Ledger design implications

- **Append-only events.** Every advance, sale, sweep, balloon, and rebate is an
  immutable event row. Balances are derived (see [`04-data-model.md`](04-data-model.md)).
- **Idempotency.** Each partner/Stripe event carries a unique id; ingest is
  idempotent so retried webhooks never double-count a sweep.
- **Reconciliation job.** A periodic job recomputes derived balances from events
  and asserts they match any maintained running totals; mismatches alert.
- **Maturity job.** A scheduled job detects deals reaching maturity and triggers
  the balloon true-up flow.
