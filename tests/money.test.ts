import { describe, it, expect } from "vitest";
import { applyBps, assertCents, formatCents, parseToCents } from "@/lib/money";

describe("money", () => {
  it("applies basis-point rates with rounding", () => {
    expect(applyBps(100_000, 4000)).toBe(40_000); // 40% of $1,000
    expect(applyBps(115_00, 100)).toBe(115); // 1% of $115.00
    expect(applyBps(333, 5000)).toBe(167); // 50% of 333c rounds to 167
  });

  it("rejects non-integer or negative cents", () => {
    expect(() => assertCents(1.5)).toThrow();
    expect(() => assertCents(-1)).toThrow();
    expect(assertCents(0)).toBe(0);
  });

  it("parses decimal money input to integer cents", () => {
    expect(parseToCents("12.50")).toBe(1250);
    expect(parseToCents("$1,000")).toBe(100_000);
    expect(parseToCents("0.05")).toBe(5);
    expect(() => parseToCents("1.234")).toThrow();
    expect(() => parseToCents("abc")).toThrow();
  });

  it("formats cents for display", () => {
    expect(formatCents(115_000)).toBe("$1,150.00");
  });
});
