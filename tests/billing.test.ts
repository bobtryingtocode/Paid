import { describe, it, expect } from "vitest";
import { hasCapacity, remainingTokens } from "@/billing/capacity";
import { getPlan, isPlanSlug, PLANS } from "@/billing/plans";

describe("capacity", () => {
  it("has capacity while used is below the allowance", () => {
    expect(hasCapacity(2_000_000, 0)).toBe(true);
    expect(hasCapacity(2_000_000, 1_999_999)).toBe(true);
    expect(hasCapacity(2_000_000, 2_000_000)).toBe(false); // hard block at the line
    expect(hasCapacity(2_000_000, 2_500_000)).toBe(false); // overshoot stays blocked
  });

  it("remaining never goes negative", () => {
    expect(remainingTokens(2_000_000, 500_000)).toBe(1_500_000);
    expect(remainingTokens(2_000_000, 2_500_000)).toBe(0);
  });
});

describe("plans", () => {
  it("resolves known plans and rejects unknown", () => {
    expect(isPlanSlug("pro")).toBe(true);
    expect(isPlanSlug("enterprise")).toBe(false);
    expect(getPlan("scale")?.monthlyTokens).toBe(PLANS.scale.monthlyTokens);
    expect(getPlan("nope")).toBeNull();
  });

  it("tiers increase in capacity and price", () => {
    expect(PLANS.starter.monthlyTokens).toBeLessThan(PLANS.pro.monthlyTokens);
    expect(PLANS.pro.monthlyTokens).toBeLessThan(PLANS.scale.monthlyTokens);
    expect(PLANS.starter.priceCents).toBeLessThan(PLANS.pro.priceCents);
    expect(PLANS.pro.priceCents).toBeLessThan(PLANS.scale.priceCents);
  });
});
