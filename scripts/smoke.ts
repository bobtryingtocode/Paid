/**
 * Offline smoke test of the procure-to-pay pipeline — no network, DB, Stripe, or
 * Claude required. Walks a sample invoice through the same domain logic the agent
 * uses and asserts the money reconciles. Prints a readable trace and exits
 * non-zero on any failed assertion, so it doubles as a CI/local sanity check.
 *
 *   npm run smoke
 */
import { formatCents } from "@/lib/money";
import type { CanonicalInvoice } from "@/agent/invoice/schema";
import { recommendPaymentPlan } from "@/domain/p2p/recommend";
import { getProvider } from "@/domain/p2p/providers";
import {
  financingDrawdownEntry,
  invoiceReceivedEntry,
  reconcile,
  scheduledPaymentEntry,
  type JournalEntry,
} from "@/domain/accounting/journal";
import { hasCapacity, remainingTokens } from "@/billing/capacity";
import { PLANS } from "@/billing/plans";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    console.error(`  ✗ ${msg}`);
    failures++;
  }
}

const invoice: CanonicalInvoice = {
  vendor: { name: "Northwind Fabrication", email: "ar@northwind.example" },
  invoiceNumber: "NW-2048",
  issueDate: "2026-06-01",
  dueDate: "2026-07-01",
  currency: "usd",
  lineItems: [
    { description: "CNC machined parts", quantity: 200, unitPriceCents: 45000, amountCents: 9_000_000 },
    { description: "Finishing & QA", quantity: 1, unitPriceCents: 1_000_000, amountCents: 1_000_000 },
  ],
  subtotalCents: 10_000_000,
  taxCents: 0,
  totalCents: 10_000_000,
  paymentTerms: "Net 30",
};

console.log(`\nInvoice ${invoice.invoiceNumber} from ${invoice.vendor.name}: ${formatCents(invoice.totalCents)}\n`);

// 1. Recommend
console.log("Recommendation:");
const rec = recommendPaymentPlan(invoice);
for (const q of [rec.recommended, ...rec.alternatives]) {
  console.log(`  - ${q.providerName}: repay ${formatCents(q.totalRepaymentCents)} over ${q.installments.length} (fee ${formatCents(q.feeCents)})`);
}
console.log(`  → recommended: ${rec.recommended.providerName} — ${rec.rationale}`);
assert(rec.recommended.totalRepaymentCents <= rec.alternatives[0].totalRepaymentCents, "recommended is the cheapest (or tied)");

// 2. Schedule (chosen provider)
const provider = getProvider(rec.recommended.providerId);
const quote = provider.quote({ totalCents: invoice.totalCents, currency: invoice.currency });
const scheduled = provider.schedulePayments(quote);
console.log("\nSchedule:");
for (const s of scheduled) console.log(`  - ${s.dueDate}: ${formatCents(s.amountCents)} (${s.status})`);
const scheduledTotal = scheduled.reduce((a, s) => a + s.amountCents, 0);
assert(scheduledTotal === quote.totalRepaymentCents, "installments sum to the total repayment");

// 3. Journal + reconcile
const entries: JournalEntry[] = [
  invoiceReceivedEntry(invoice.totalCents),
  financingDrawdownEntry(invoice.totalCents, quote.feeCents),
];
const midway = reconcile(entries);
console.log(`\nAfter drawdown, outstanding to financer: ${formatCents(midway.outstandingFinancingPayableCents)}`);
assert(midway.balanced, "journal balances after drawdown");
assert(midway.outstandingFinancingPayableCents === quote.totalRepaymentCents, "outstanding equals total repayment before any payments");

for (const s of scheduled) entries.push(scheduledPaymentEntry(s.amountCents));
const final = reconcile(entries);
console.log(`After all scheduled payments, outstanding: ${formatCents(final.outstandingFinancingPayableCents)}`);
assert(final.balanced, "journal balances after all payments");
assert(final.outstandingFinancingPayableCents === 0, "outstanding clears to zero");

// 4. Capacity (per-token metering, hard block)
console.log("\nCapacity (Pro plan):");
const allowance = PLANS.pro.monthlyTokens;
console.log(`  allowance ${allowance.toLocaleString()} tokens`);
assert(hasCapacity(allowance, 0), "fresh period has capacity");
assert(remainingTokens(allowance, allowance) === 0, "remaining is zero at the limit");
assert(!hasCapacity(allowance, allowance), "hard block at the allowance");

console.log(failures === 0 ? "\n✅ smoke passed\n" : `\n❌ smoke failed (${failures})\n`);
process.exit(failures === 0 ? 0 : 1);
