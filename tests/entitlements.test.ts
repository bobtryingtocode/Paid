import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  prisma: {
    subscription: { findUnique: vi.fn() },
    usagePeriod: { upsert: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));

import { checkCapacity, recordUsage } from "@/billing/entitlements";

function activeSub() {
  return {
    id: "s1",
    merchantId: "m1",
    planSlug: "pro", // 20,000,000 tokens
    status: "ACTIVE",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    currentPeriodStart: new Date(Date.now() - 86_400_000),
    currentPeriodEnd: new Date(Date.now() + 86_400_000),
    createdAt: new Date(),
  };
}

describe("entitlements", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks when there is no active subscription", async () => {
    h.prisma.subscription.findUnique.mockResolvedValue(null);
    const c = await checkCapacity("m1");
    expect(c.allowed).toBe(false);
    expect(c.reason).toMatch(/subscription/i);
  });

  it("allows when usage is under the plan allowance", async () => {
    h.prisma.subscription.findUnique.mockResolvedValue(activeSub());
    h.prisma.usagePeriod.upsert.mockResolvedValue({ id: "up1", totalTokens: BigInt(1_000) });
    const c = await checkCapacity("m1");
    expect(c.allowed).toBe(true);
    expect(c.usagePeriodId).toBe("up1");
    expect(c.remainingTokens).toBe(20_000_000 - 1_000);
  });

  it("hard-blocks at/over the allowance", async () => {
    h.prisma.subscription.findUnique.mockResolvedValue(activeSub());
    h.prisma.usagePeriod.upsert.mockResolvedValue({ id: "up1", totalTokens: BigInt(20_000_000) });
    const c = await checkCapacity("m1");
    expect(c.allowed).toBe(false);
    expect(c.remainingTokens).toBe(0);
  });

  it("blocks an expired period (currentPeriodEnd in the past)", async () => {
    h.prisma.subscription.findUnique.mockResolvedValue({
      ...activeSub(),
      currentPeriodEnd: new Date(Date.now() - 1000),
    });
    const c = await checkCapacity("m1");
    expect(c.allowed).toBe(false);
  });

  it("records usage as increments + one run", async () => {
    h.prisma.usagePeriod.update.mockResolvedValue({});
    await recordUsage("up1", 80, 20);
    expect(h.prisma.usagePeriod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "up1" },
        data: expect.objectContaining({ runs: { increment: 1 } }),
      }),
    );
  });
});
