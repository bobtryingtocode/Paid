import { createHmac } from "node:crypto";

/**
 * Workflow event types for the transaction journey. Each is recorded in the
 * append-only audit log and emitted (non-PII) to outbound webhooks.
 */
export const EVENT_TYPES = {
  billCreated: "bill.created",
  billEmailed: "bill.emailed",
  paymentApproved: "payment.approved",
  transactionReconciled: "transaction.reconciled",
  payoutPaid: "payout.paid",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
export type Actor = "merchant" | "system" | "stripe" | "customer";

export interface AuditEventRecord {
  id: string;
  merchantId: string;
  paymentLinkId: string | null;
  type: string;
  actor: string;
  amountCents: number | null;
  currency: string | null;
  detail: Record<string, unknown> | null;
  createdAt: Date;
}

/**
 * Build the outbound (Zapier) webhook payload. NON-PII by construction: only ids,
 * type/actor, amount/currency, timestamp, and the event's non-PII detail. No
 * customer name/email/bank details ever appear here.
 */
export function buildEventPayload(e: AuditEventRecord) {
  return {
    id: e.id,
    type: e.type,
    actor: e.actor,
    merchantId: e.merchantId,
    paymentLinkId: e.paymentLinkId,
    amountCents: e.amountCents,
    currency: e.currency,
    detail: e.detail ?? {},
    createdAt: e.createdAt.toISOString(),
  };
}

/** HMAC-SHA256 signature of the serialized payload, for consumers to verify. */
export function signPayload(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}
