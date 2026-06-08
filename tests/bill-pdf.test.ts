import { describe, it, expect } from "vitest";
import { buildBillPdf } from "@/bill/pdf";

describe("bill PDF", () => {
  it("produces a non-empty PDF document", async () => {
    const bytes = await buildBillPdf({
      merchantName: "Green Thumb Landscaping",
      billNumber: "abc12345",
      description: "Lawn care — June",
      amountCents: 25_000,
      currency: "usd",
      payUrl: "https://example.com/pay/tok123",
    });
    expect(bytes.byteLength).toBeGreaterThan(500);
    // PDF magic header "%PDF"
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x25, 0x50, 0x44, 0x46]);
  });

  it("handles a null description", async () => {
    const bytes = await buildBillPdf({
      merchantName: "Acme Services",
      billNumber: "x",
      description: null,
      amountCents: 100,
      currency: "usd",
      payUrl: "https://example.com/pay/x",
    });
    expect(bytes.byteLength).toBeGreaterThan(500);
  });
});
