import { describe, it, expect, vi, beforeEach } from "vitest";

// Mockable boundaries (hoisted so the vi.mock factories can reference them).
const h = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  recordEvent: vi.fn(),
  prisma: {
    webhookEvent: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    merchant: { findUnique: vi.fn() },
    paymentLink: { findUnique: vi.fn() },
    partner: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/stripe", () => ({ getStripe: () => ({ webhooks: { constructEvent: h.constructEvent } }) }));
vi.mock("@/lib/prisma", () => ({ prisma: h.prisma }));
vi.mock("@/audit/log", () => ({ recordEvent: h.recordEvent }));

import { POST } from "@/app/api/webhooks/stripe/route";

function req(body = "{}") {
  return new Request("http://x/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "sig" },
    body,
  });
}

describe("stripe webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  });

  it("rejects an invalid signature with 400", async () => {
    h.constructEvent.mockImplementation(() => {
      throw new Error("bad signature");
    });
    const res = await POST(req());
    expect(res.status).toBe(400);
    expect(h.recordEvent).not.toHaveBeenCalled();
  });

  it("is idempotent: an already-processed event does no work", async () => {
    h.constructEvent.mockReturnValue({ id: "evt_1", type: "payout.paid", account: "acct_1", data: { object: {} } });
    h.prisma.webhookEvent.findUnique.mockResolvedValue({ processedAt: new Date() });

    const res = await POST(req());
    const json = await res.json();

    expect(json.duplicate).toBe(true);
    expect(h.prisma.webhookEvent.create).not.toHaveBeenCalled();
    expect(h.recordEvent).not.toHaveBeenCalled();
  });

  it("processes payout.paid once and maps event.account → merchant", async () => {
    h.constructEvent.mockReturnValue({
      id: "evt_2",
      type: "payout.paid",
      account: "acct_1",
      data: { object: { amount: 5000, currency: "usd", arrival_date: 123, status: "paid" } },
    });
    h.prisma.webhookEvent.findUnique.mockResolvedValue(null);
    h.prisma.webhookEvent.create.mockResolvedValue({});
    h.prisma.webhookEvent.update.mockResolvedValue({});
    h.prisma.merchant.findUnique.mockResolvedValue({ id: "m_1" });

    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(h.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "payout.paid", merchantId: "m_1", amountCents: 5000, currency: "usd" }),
    );
    expect(h.prisma.webhookEvent.update).toHaveBeenCalled(); // marked processed
  });

  it("ignores unconfigured webhooks (missing secret) with 400", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(req());
    expect(res.status).toBe(400);
  });
});
