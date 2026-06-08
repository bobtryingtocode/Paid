import { describe, it, expect } from "vitest";
import {
  DEFAULT_OFFERINGS,
  enabledMethods,
  isMethodEnabled,
  type PaymentOfferings,
} from "@/merchant/payment-settings";

describe("payment offerings", () => {
  it("defaults to pay-over-time and card, in display order", () => {
    expect(enabledMethods(DEFAULT_OFFERINGS)).toEqual(["pay_over_time", "card"]);
  });

  it("includes subscription only when a price id is set", () => {
    const withoutPrice: PaymentOfferings = {
      offerCard: false,
      offerPayOverTime: false,
      offerSubscription: true,
      subscriptionPriceId: null,
    };
    expect(enabledMethods(withoutPrice)).toEqual([]); // misconfigured → not offered

    const withPrice: PaymentOfferings = { ...withoutPrice, subscriptionPriceId: "price_123" };
    expect(enabledMethods(withPrice)).toEqual(["subscription"]);
  });

  it("isMethodEnabled reflects the enabled set", () => {
    expect(isMethodEnabled(DEFAULT_OFFERINGS, "card")).toBe(true);
    expect(isMethodEnabled(DEFAULT_OFFERINGS, "subscription")).toBe(false);
  });
});
