import { describe, it, expect } from "vitest";
import { buildEventPayload, signPayload, type AuditEventRecord } from "@/audit/events";

const sample: AuditEventRecord = {
  id: "evt_1",
  merchantId: "m_1",
  paymentLinkId: "pl_1",
  type: "bill.emailed",
  actor: "merchant",
  amountCents: 25_000,
  currency: "usd",
  detail: { provider: "resend", delivered: true },
  createdAt: new Date("2026-06-08T00:00:00.000Z"),
};

describe("audit event payload", () => {
  it("emits ids/amount/status but no PII fields", () => {
    const p = buildEventPayload(sample);
    expect(p).toEqual({
      id: "evt_1",
      type: "bill.emailed",
      actor: "merchant",
      merchantId: "m_1",
      paymentLinkId: "pl_1",
      amountCents: 25_000,
      currency: "usd",
      detail: { provider: "resend", delivered: true },
      createdAt: "2026-06-08T00:00:00.000Z",
    });
    // No PII field names anywhere (top-level or in detail) — checked on keys,
    // not values (an event *type* like "bill.emailed" legitimately contains "email").
    const keys = [...Object.keys(p), ...Object.keys(p.detail ?? {})].map((k) => k.toLowerCase());
    for (const pii of ["email", "name", "phone", "address", "routing", "ssn"]) {
      expect(keys.some((k) => k.includes(pii))).toBe(false);
    }
  });

  it("signs the payload deterministically (HMAC-SHA256)", () => {
    const body = JSON.stringify(buildEventPayload(sample));
    const a = signPayload(body, "secret");
    const b = signPayload(body, "secret");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(signPayload(body, "other")).not.toBe(a);
  });
});
