import { describe, it, expect } from "vitest";
import { recommendPaymentPlan } from "@/domain/p2p/recommend";
import { PROVIDERS, getProvider } from "@/domain/p2p/providers";
import {
  INITIAL_STATE,
  canTransition,
  nextState,
  transition,
} from "@/domain/p2p/workflow";

describe("providers", () => {
  it("pay-in-4 splits exactly into 4 with no fee", () => {
    const q = getProvider("klarna").quote({ totalCents: 100_001, currency: "usd" });
    expect(q.installments).toHaveLength(4);
    expect(q.feeCents).toBe(0);
    expect(q.installments.reduce((s, i) => s + i.amountCents, 0)).toBe(100_001);
    expect(q.totalRepaymentCents).toBe(100_001);
  });

  it("stripe adds a financing fee across 3 monthly installments", () => {
    const q = getProvider("stripe").quote({ totalCents: 100_000, currency: "usd" });
    expect(q.installments).toHaveLength(3);
    expect(q.feeCents).toBe(6_000); // 6%
    expect(q.totalRepaymentCents).toBe(106_000);
    expect(q.installments.reduce((s, i) => s + i.amountCents, 0)).toBe(106_000);
  });

  it("schedulePayments returns one scheduled payment per installment", () => {
    const q = getProvider("afterpay").quote({ totalCents: 40_000, currency: "usd" });
    const scheduled = getProvider("afterpay").schedulePayments(q);
    expect(scheduled).toHaveLength(4);
    expect(scheduled.every((s) => s.status === "scheduled")).toBe(true);
  });
});

describe("recommend", () => {
  it("ranks the cheapest total repayment first (fee-free beats Stripe's fee)", () => {
    const rec = recommendPaymentPlan({ totalCents: 100_000, currency: "usd" });
    expect(rec.recommended.totalRepaymentCents).toBe(100_000);
    expect(rec.recommended.providerId).not.toBe("stripe");
    expect(rec.alternatives.length).toBe(Object.keys(PROVIDERS).length - 1);
  });

  it("honors a preferred provider", () => {
    const rec = recommendPaymentPlan({ totalCents: 100_000, currency: "usd" }, "stripe");
    expect(rec.recommended.providerId).toBe("stripe");
  });
});

describe("workflow", () => {
  it("walks the happy path and rejects skips", () => {
    expect(INITIAL_STATE).toBe("REQUESTED");
    expect(nextState("REQUESTED")).toBe("INVOICE_RECEIVED");
    expect(canTransition("EXTRACTED", "PLAN_RECOMMENDED")).toBe(true);
    expect(canTransition("REQUESTED", "SCHEDULED")).toBe(false);
    expect(transition("SCHEDULED", "RECONCILED")).toBe("RECONCILED");
    expect(() => transition("REQUESTED", "CLOSED")).toThrow();
    expect(nextState("CLOSED")).toBeNull();
  });
});
