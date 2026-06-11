import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  prisma: { auditEvent: { create: vi.fn(), findMany: vi.fn() } },
  emitEvent: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/audit/webhook", () => ({ emitEvent: h.emitEvent }));

import { recordEvent, getJourney } from "@/audit/log";

describe("audit log", () => {
  beforeEach(() => vi.clearAllMocks());

  it("writes the row (BigInt cents) and emits a normalized record", async () => {
    h.prisma.auditEvent.create.mockResolvedValue({
      id: "a1",
      merchantId: "m1",
      paymentLinkId: "pl1",
      type: "bill.created",
      actor: "merchant",
      amountCents: BigInt(1_000),
      currency: "usd",
      detail: null,
      createdAt: new Date("2026-06-08T00:00:00Z"),
    });

    await recordEvent({
      merchantId: "m1",
      type: "bill.created",
      actor: "merchant",
      paymentLinkId: "pl1",
      amountCents: 1_000,
      currency: "usd",
    });

    expect(h.prisma.auditEvent.create).toHaveBeenCalledTimes(1);
    // emitted record carries a number (not BigInt) and the row id
    expect(h.emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a1", type: "bill.created", amountCents: 1_000 }),
    );
  });

  it("getJourney queries the transaction's events in order", async () => {
    h.prisma.auditEvent.findMany.mockResolvedValue([]);
    await getJourney("m1", "pl1");
    expect(h.prisma.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { merchantId: "m1", paymentLinkId: "pl1" },
        orderBy: { createdAt: "asc" },
      }),
    );
  });
});
