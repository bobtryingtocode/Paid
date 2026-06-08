import { describe, it, expect } from "vitest";
import {
  deriveMerchantNetCents,
  dedupeBySource,
  type LedgerEventInput,
} from "@/lib/ledger";

describe("ledger", () => {
  it("derives merchant net from funding minus fee", () => {
    const events: LedgerEventInput[] = [
      { kind: "FUNDING", amountCents: 100_000 },
      { kind: "FEE", amountCents: 1_000 },
    ];
    expect(deriveMerchantNetCents(events)).toBe(99_000);
  });

  it("applies adjustments", () => {
    const events: LedgerEventInput[] = [
      { kind: "FUNDING", amountCents: 50_000 },
      { kind: "ADJUSTMENT", amountCents: -500 },
    ];
    expect(deriveMerchantNetCents(events)).toBe(49_500);
  });

  it("dedupes replayed events by sourceEventId so funding is never double-counted", () => {
    const events: LedgerEventInput[] = [
      { kind: "FUNDING", amountCents: 100_000, sourceEventId: "evt_1" },
      { kind: "FUNDING", amountCents: 100_000, sourceEventId: "evt_1" }, // replay
    ];
    const deduped = dedupeBySource(events);
    expect(deduped).toHaveLength(1);
    expect(deriveMerchantNetCents(deduped)).toBe(100_000);
  });

  it("keeps events without a sourceEventId", () => {
    const events: LedgerEventInput[] = [
      { kind: "ADJUSTMENT", amountCents: 100 },
      { kind: "ADJUSTMENT", amountCents: 100 },
    ];
    expect(dedupeBySource(events)).toHaveLength(2);
  });
});
