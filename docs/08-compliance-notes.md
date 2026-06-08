# 08 · Compliance notes — the orchestration line

> **Not legal or financial advice.** This is a product-design and architecture
> document. Anything involving advancing funds, lending, or moving customer
> money carries licensing and compliance obligations that vary by state and by
> partner. **Have a fintech attorney confirm the structure before launch** —
> especially the line between "orchestration layer" and "regulated lender."
> Figures throughout these docs are illustrative.

## The line that must not be crossed

| Cadence DOES (orchestration) | Cadence must NOT (regulated activity) |
|------------------------------|----------------------------------------|
| Build the experience and the UX | Hold customer or merchant funds in its own account |
| Coordinate partners and present the right checkout | Lend its own money / advance its own capital |
| Keep the authoritative ledger / system of record | Set the credit terms or underwrite the payer |
| Route money via Stripe Connect (`partner → Stripe → merchant`) | Become the money-transmitter / custodian |
| Earn a **share of the partner's fee** | Earn interest as a lender |

Cross any item in the right column and Cadence becomes a regulated bank /
money-transmitter — licensing in all 50 states, large capital requirements, and
a heavy compliance burden. That is the difference between a ~6-month build and a
multi-year regulated-entity slog.

## How the architecture enforces the line

- **No custody.** Funds move `partner → Stripe → merchant`. Cadence never has a
  pooled account holding others' money. (See
  [`01-architecture.md`](01-architecture.md).)
- **Partners own underwriting.** Approval/credit decisions happen in the
  partner's API. Cadence has **no credit model** — explicitly out of scope (see
  [`07-roadmap.md`](07-roadmap.md)).
- **Non-recourse risk sits with the partner** (Models A/B): if the payer never
  pays, that's the partner's loss.
- **Model C collateral, not Cadence capital.** The advance is the financer's;
  the inventory (UCC lien) and often a personal guarantee back it. Cadence
  provides the sweep mechanism and the system of record, not the money.

## Things to get an attorney to confirm before launch

1. The "orchestration layer vs. regulated lender" classification for each model
   in the target states.
2. Whether the Model C structure (advance + factor + sweep + balloon) is
   characterized as a sale of future receivables vs. a loan, and the
   implications.
3. Money-transmission exposure given that sweeps flow through Stripe Connect
   (relying on Stripe's licensing) — confirm Cadence's role stays
   facilitator-only.
4. Required merchant and payer disclosures per partner and per state.
5. Personal-guarantee and UCC-lien documentation for Model C deals.

## Reselling Claude API access (metered agent)

The procure-to-pay agent ([`09`](09-procure-to-pay-agent.md)) is sold on a
subscription with per-token capacity ([`10`](10-metering-and-billing.md)).
Customers use the platform's single Anthropic key — they don't bring their own.

- **Value-added product vs. raw resale.** Building a product *on* the Claude API
  (our agent, metered by our tiers) is ordinary SaaS. Reselling *raw,
  pass-through* API access ("buy Claude tokens through us") can fall under
  Anthropic's commercial terms / usage policies and may require their sign-off.
  Frame and price the offering as the agent-with-included-capacity, not as token
  resale.
- **Confirm before launch.** Have Anthropic and a commercial attorney confirm the
  reselling model — this is the API-terms analogue of the
  orchestration-vs-lender line above.

## Standing reminders for the team

- If a feature would require Cadence to **hold, lend, or set terms on** money,
  stop and re-read this page.
- Keep partner relationships such that **license, capital, underwriting, and
  risk** always sit with the partner.
- Revenue model is **a share of the partner's fee** — design pricing around
  that, not around interest or float.
