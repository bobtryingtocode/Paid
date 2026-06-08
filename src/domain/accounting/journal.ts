import { randomUUID } from "node:crypto";
import type { Cents } from "@/lib/money";

/**
 * Minimal double-entry bookkeeping. Every journal entry must balance (total
 * debits == total credits); account balances are derived by summing entries.
 * Used by the procure-to-pay agent to record the invoice, the financing
 * drawdown, and each scheduled payment, then reconcile outstanding balances.
 */
export type Account =
  | "INVENTORY_OR_EXPENSE"
  | "ACCOUNTS_PAYABLE"
  | "FINANCING_PAYABLE"
  | "FINANCING_FEE_EXPENSE"
  | "CASH";

export interface JournalLine {
  account: Account;
  debitCents: Cents;
  creditCents: Cents;
}

export interface JournalEntry {
  id: string;
  memo: string;
  date: string; // ISO YYYY-MM-DD
  lines: JournalLine[];
}

const today = () => new Date().toISOString().slice(0, 10);

function entry(memo: string, lines: JournalLine[], date = today()): JournalEntry {
  const e: JournalEntry = { id: randomUUID(), memo, date, lines };
  assertBalanced(e);
  return e;
}

/** Throw if an entry's debits and credits do not balance. */
export function assertBalanced(e: JournalEntry): void {
  const debit = e.lines.reduce((s, l) => s + l.debitCents, 0);
  const credit = e.lines.reduce((s, l) => s + l.creditCents, 0);
  if (debit !== credit) {
    throw new Error(`Unbalanced journal entry "${e.memo}": ${debit} != ${credit}`);
  }
}

/** Invoice received: recognize the cost and the payable to the vendor. */
export function invoiceReceivedEntry(totalCents: Cents, memo = "Invoice received"): JournalEntry {
  return entry(memo, [
    { account: "INVENTORY_OR_EXPENSE", debitCents: totalCents, creditCents: 0 },
    { account: "ACCOUNTS_PAYABLE", debitCents: 0, creditCents: totalCents },
  ]);
}

/**
 * Financing drawdown: the financer pays the vendor (clearing AP) and the
 * business now owes the financer the advance plus the financing fee.
 */
export function financingDrawdownEntry(
  advanceCents: Cents,
  feeCents: Cents,
  memo = "Financing drawdown",
): JournalEntry {
  const lines: JournalLine[] = [
    { account: "ACCOUNTS_PAYABLE", debitCents: advanceCents, creditCents: 0 },
    { account: "FINANCING_PAYABLE", debitCents: 0, creditCents: advanceCents + feeCents },
  ];
  if (feeCents > 0) {
    lines.push({ account: "FINANCING_FEE_EXPENSE", debitCents: feeCents, creditCents: 0 });
  }
  return entry(memo, lines);
}

/** A scheduled installment paid: reduce the financing payable, pay cash. */
export function scheduledPaymentEntry(amountCents: Cents, memo = "Scheduled payment"): JournalEntry {
  return entry(memo, [
    { account: "FINANCING_PAYABLE", debitCents: amountCents, creditCents: 0 },
    { account: "CASH", debitCents: 0, creditCents: amountCents },
  ]);
}

export interface TrialBalance {
  balances: Record<Account, Cents>; // signed net (debit positive)
  totalDebits: Cents;
  totalCredits: Cents;
  balanced: boolean;
  /** Remaining amount owed to the financer (credit-normal, reported positive). */
  outstandingFinancingPayableCents: Cents;
}

/** Reconcile a set of entries into a trial balance with net account positions. */
export function reconcile(entries: JournalEntry[]): TrialBalance {
  const balances: Record<Account, Cents> = {
    INVENTORY_OR_EXPENSE: 0,
    ACCOUNTS_PAYABLE: 0,
    FINANCING_PAYABLE: 0,
    FINANCING_FEE_EXPENSE: 0,
    CASH: 0,
  };
  let totalDebits = 0;
  let totalCredits = 0;
  for (const e of entries) {
    for (const l of e.lines) {
      balances[l.account] += l.debitCents - l.creditCents;
      totalDebits += l.debitCents;
      totalCredits += l.creditCents;
    }
  }
  return {
    balances,
    totalDebits,
    totalCredits,
    balanced: totalDebits === totalCredits,
    // `|| 0` normalizes -0 to 0 (credit-normal account negated).
    outstandingFinancingPayableCents: -balances.FINANCING_PAYABLE || 0,
  };
}
