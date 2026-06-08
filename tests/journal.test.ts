import { describe, it, expect } from "vitest";
import {
  assertBalanced,
  financingDrawdownEntry,
  invoiceReceivedEntry,
  reconcile,
  scheduledPaymentEntry,
} from "@/domain/accounting/journal";

describe("journal", () => {
  it("invoice received balances and credits accounts payable", () => {
    const e = invoiceReceivedEntry(125_000);
    expect(() => assertBalanced(e)).not.toThrow();
    const tb = reconcile([e]);
    expect(tb.balances.INVENTORY_OR_EXPENSE).toBe(125_000);
    expect(tb.balances.ACCOUNTS_PAYABLE).toBe(-125_000);
    expect(tb.balanced).toBe(true);
  });

  it("financing drawdown clears AP and owes financer total + fee", () => {
    const invoice = invoiceReceivedEntry(100_000);
    const draw = financingDrawdownEntry(100_000, 6_000);
    const tb = reconcile([invoice, draw]);
    expect(tb.balances.ACCOUNTS_PAYABLE).toBe(0); // -100k + 100k
    expect(tb.outstandingFinancingPayableCents).toBe(106_000);
    expect(tb.balances.FINANCING_FEE_EXPENSE).toBe(6_000);
    expect(tb.balanced).toBe(true);
  });

  it("scheduled payments reduce the outstanding financing balance", () => {
    const entries = [
      invoiceReceivedEntry(100_000),
      financingDrawdownEntry(100_000, 6_000),
      scheduledPaymentEntry(53_000),
      scheduledPaymentEntry(53_000),
    ];
    const tb = reconcile(entries);
    expect(tb.outstandingFinancingPayableCents).toBe(0);
    expect(tb.balances.CASH).toBe(-106_000);
    expect(tb.balanced).toBe(true);
  });

  it("rejects an unbalanced entry", () => {
    expect(() =>
      assertBalanced({
        id: "x",
        memo: "bad",
        date: "2026-01-01",
        lines: [
          { account: "CASH", debitCents: 100, creditCents: 0 },
          { account: "ACCOUNTS_PAYABLE", debitCents: 0, creditCents: 50 },
        ],
      }),
    ).toThrow();
  });
});
