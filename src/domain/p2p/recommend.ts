import { formatCents } from "@/lib/money";
import type { CanonicalInvoice } from "@/agent/invoice/schema";
import {
  PROVIDERS,
  type PaymentPlanQuote,
  type ProviderId,
} from "./providers";

export interface PaymentPlanRecommendation {
  recommended: PaymentPlanQuote;
  alternatives: PaymentPlanQuote[];
  rationale: string;
}

/**
 * Recommend a payment plan for an invoice by quoting every provider and ranking
 * by total cost to the business (cheapest repayment first; earlier-cleared as a
 * tiebreak). Deterministic and pure so it is fully unit-testable.
 */
export function recommendPaymentPlan(
  invoice: Pick<CanonicalInvoice, "totalCents" | "currency">,
  preferredProvider?: ProviderId,
): PaymentPlanRecommendation {
  const quotes = (Object.keys(PROVIDERS) as ProviderId[]).map((id) =>
    PROVIDERS[id].quote({
      totalCents: invoice.totalCents,
      currency: invoice.currency,
    }),
  );

  quotes.sort((a, b) => {
    if (a.totalRepaymentCents !== b.totalRepaymentCents) {
      return a.totalRepaymentCents - b.totalRepaymentCents;
    }
    // tiebreak: clear the balance sooner (earlier last-installment date)
    return lastDueDate(a).localeCompare(lastDueDate(b));
  });

  let recommended = quotes[0];
  if (preferredProvider) {
    const pref = quotes.find((q) => q.providerId === preferredProvider);
    if (pref) recommended = pref;
  }
  const alternatives = quotes.filter((q) => q !== recommended);

  return { recommended, alternatives, rationale: rationaleFor(recommended, invoice.currency) };
}

function lastDueDate(q: PaymentPlanQuote): string {
  return q.installments[q.installments.length - 1]?.dueDate ?? "";
}

function rationaleFor(q: PaymentPlanQuote, currency: string): string {
  const fee =
    q.feeCents > 0
      ? `a ${formatCents(q.feeCents, currency)} financing fee`
      : "no financing fee";
  return (
    `${q.providerName} (${q.shape}) repays ${formatCents(q.totalRepaymentCents, currency)} ` +
    `across ${q.installments.length} installments with ${fee}, ` +
    `clearing by ${lastDueDate(q)}.`
  );
}
