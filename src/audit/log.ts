import { prisma } from "@/lib/prisma";
import { emitEvent } from "./webhook";
import type { Actor, AuditEventRecord, EventType } from "./events";

export interface RecordEventInput {
  merchantId: string;
  type: EventType;
  actor: Actor;
  paymentLinkId?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  /** NON-PII metadata only (statuses, method, provider, ids). */
  detail?: Record<string, unknown> | null;
}

/**
 * Append an event to the audit log (system of record) and emit it to the
 * outbound webhook. The DB write is authoritative; the webhook is best-effort.
 */
export async function recordEvent(input: RecordEventInput): Promise<void> {
  const row = await prisma.auditEvent.create({
    data: {
      merchantId: input.merchantId,
      paymentLinkId: input.paymentLinkId ?? null,
      type: input.type,
      actor: input.actor,
      amountCents: input.amountCents != null ? BigInt(input.amountCents) : null,
      currency: input.currency ?? null,
      detail: (input.detail ?? undefined) as object | undefined,
    },
  });

  const record: AuditEventRecord = {
    id: row.id,
    merchantId: row.merchantId,
    paymentLinkId: row.paymentLinkId,
    type: row.type,
    actor: row.actor,
    amountCents: row.amountCents != null ? Number(row.amountCents) : null,
    currency: row.currency,
    detail: (row.detail as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt,
  };
  await emitEvent(record);
}

/** The ordered audit timeline for one transaction (payment link). */
export async function getJourney(merchantId: string, paymentLinkId: string) {
  return prisma.auditEvent.findMany({
    where: { merchantId, paymentLinkId },
    orderBy: { createdAt: "asc" },
  });
}
