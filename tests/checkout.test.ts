import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  create: vi.fn().mockResolvedValue({ url: "https://stripe.test/checkout" }),
}));
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ checkout: { sessions: { create: h.create } } }),
}));

import { buildCheckoutSession } from "@/domain/checkout";

const base = {
  linkToken: "tok",
  amountCents: 10_000,
  currency: "usd",
  description: "Lawn care",
  merchantStripeAccountId: "acct_1",
  offerings: {
    offerCard: true,
    offerPayOverTime: true,
    offerSubscription: true,
    subscriptionPriceId: "price_1",
  },
  successUrl: "https://app/success",
  cancelUrl: "https://app/cancel",
} as const;

describe("buildCheckoutSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("card → card-only payment, on the connected account, with app fee", async () => {
    const url = await buildCheckoutSession({ ...base, method: "card" });
    expect(url).toBe("https://stripe.test/checkout");
    const [params, opts] = h.create.mock.calls[0];
    expect(params.mode).toBe("payment");
    expect(params.payment_method_types).toEqual(["card"]);
    expect(params.payment_intent_data.application_fee_amount).toBe(100); // 1% of 10,000
    expect(opts).toEqual({ stripeAccount: "acct_1" });
  });

  it("pay_over_time → Klarna/Affirm/card", async () => {
    await buildCheckoutSession({ ...base, method: "pay_over_time" });
    const [params] = h.create.mock.calls[0];
    expect(params.payment_method_types).toEqual(["klarna", "affirm", "card"]);
  });

  it("subscription → subscription mode on the seller's price", async () => {
    await buildCheckoutSession({ ...base, method: "subscription" });
    const [params, opts] = h.create.mock.calls[0];
    expect(params.mode).toBe("subscription");
    expect(params.line_items[0].price).toBe("price_1");
    expect(opts).toEqual({ stripeAccount: "acct_1" });
  });

  it("subscription without a price id throws", async () => {
    await expect(
      buildCheckoutSession({
        ...base,
        method: "subscription",
        offerings: { ...base.offerings, subscriptionPriceId: null },
      }),
    ).rejects.toThrow(/subscription/i);
  });
});
