# 09 · Procure-to-pay invoice agent

An in-app agent that ingests a **PDF invoice of project costs**, recommends a
payment plan with the supplier/vendor's financing provider (Stripe / Klarna /
Afterpay), schedules the payments, and posts reconciling **double-entry journal
entries**. It is built on the **Claude Messages API with tool use**
(`claude-opus-4-8`, adaptive thinking) — the recommended surface for a custom
agent whose tools you host yourself.

> Why not the Allotrope Data Format (ADF)? ADF is a standard for scientific /
> lab-instrument data and does not fit financial documents. Extraction
> normalizes invoices into a purpose-built **canonical invoice JSON** schema
> instead (`src/agent/invoice/schema.ts`).

## Pipeline

```
 PDF / text / JSON          extract            recommend           approve & schedule        post & reconcile
 ───────────────  ──▶  CanonicalInvoice  ──▶  ranked plan   ──▶   provider installments  ──▶  journal + trial balance
   (the request)        (Claude, forced       (Stripe/Klarna/      (stubbed partner call)      (double-entry, balanced)
                         emit_invoice tool)    Afterpay quotes)
```

The procure-to-pay **workflow** is a small state machine
(`src/domain/p2p/workflow.ts`):

```
REQUESTED → INVOICE_RECEIVED → EXTRACTED → PLAN_RECOMMENDED
          → PLAN_APPROVED → SCHEDULED → RECONCILED → CLOSED
```

## Components

| Path | Responsibility |
|------|----------------|
| `src/agent/anthropic.ts` | Lazy, server-only Claude client + a thin `createMessage` wrapper (isolates SDK-version drift for adaptive thinking / `output_config`) |
| `src/agent/invoice/schema.ts` | Canonical invoice zod schema + the `emit_invoice` tool JSON schema |
| `src/agent/invoice/extract.ts` | PDF/text → `CanonicalInvoice` via a forced-tool extraction call |
| `src/domain/p2p/providers.ts` | `FinancingProvider` interface + Stripe / Klarna / Afterpay (stubbed, deterministic quotes & scheduling) |
| `src/domain/p2p/recommend.ts` | Quote all providers, rank by total cost, return a recommendation |
| `src/domain/p2p/workflow.ts` | Procure-to-pay state machine (pure transitions) |
| `src/domain/accounting/journal.ts` | Double-entry journal entries + reconciliation / trial balance |
| `src/agent/p2p/tools.ts` | Agent tool definitions + executor over a run context |
| `src/agent/p2p/agent.ts` | The tool-use loop that drives an invoice to RECONCILED |
| `src/app/api/agent/p2p/route.ts` | **AI gateway** — HTTP endpoint exposing the agent |

## The agent's tools

| Tool | Effect |
|------|--------|
| `recommend_payment_plan` | Quote Stripe/Klarna/Afterpay; return ranked recommendation; → `PLAN_RECOMMENDED` |
| `approve_and_schedule` | Approve a provider's plan, schedule installments; → `SCHEDULED` |
| `post_journal_entries` | Post invoice-received + financing-drawdown entries, reconcile; → `RECONCILED` |
| `get_status` | Current workflow state + key figures |

## Money model (per run)

- **Invoice received:** debit Inventory/Expense, credit Accounts Payable (total).
- **Financing drawdown:** debit Accounts Payable (advance, clearing the vendor),
  credit Financing Payable (advance + fee); debit Financing Fee Expense (fee).
- **Scheduled payment:** debit Financing Payable, credit Cash.
- **Reconcile:** sum entries into a trial balance; `outstandingFinancingPayable`
  is what's still owed to the financer. Every entry must balance
  (`assertBalanced`); the trial balance asserts total debits == total credits.

Provider economics (illustrative): Klarna/Afterpay are **pay-in-4** (4 biweekly
installments, no financing fee); Stripe is **3 monthly** installments with a 6%
financing fee. The recommender therefore prefers the fee-free pay-in-4 plans
unless a provider is explicitly preferred.

## The AI gateway

```
POST /api/agent/p2p
Content-Type: application/json

# one of:
{ "pdfBase64": "<base64 PDF>" }
{ "text": "<plain-text invoice>" }
{ "invoice": { ...CanonicalInvoice } }
```

Response:

```json
{
  "invoice":  { ...normalized canonical invoice... },
  "summary":  "Chose Klarna (pay_in_4)... outstanding $0 after schedule...",
  "context": {
    "state": "RECONCILED",
    "chosenProvider": "klarna",
    "totalRepaymentCents": 100000,
    "scheduledPayments": [ ... ],
    "trialBalance": { "balanced": true, "outstandingFinancingPayableCents": 100000, ... }
  }
}
```

## Configuration

Requires `ANTHROPIC_API_KEY` (server-only; never `NEXT_PUBLIC_*`). The client is
constructed lazily, so the route compiles and the rest of the app builds without
the key present — it's only needed when the agent actually runs.

## Status & guardrails

- Provider scheduling is **stubbed** (no live Stripe/Klarna/Afterpay
  credentials in this environment); swapping a stub for a real API means
  implementing the `FinancingProvider` interface — nothing else changes.
- Consistent with the orchestration-not-lender principle
  ([`08-compliance-notes.md`](08-compliance-notes.md)): the agent recommends and
  records; the financing partner holds the capital and risk.
- Pure modules (providers, recommend, workflow, journal) are unit-tested; the
  extraction and agent-loop calls require a live API key and are exercised
  end-to-end via the gateway.
