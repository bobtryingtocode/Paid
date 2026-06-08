/**
 * Ledger helpers. The ledger is append-only (see docs/03-ledger-and-sweep.md and
 * docs/04-data-model.md): every money movement is an immutable event, and
 * balances are *derived* from events rather than edited in place.
 *
 * These pure functions operate on plain event records so they are trivially
 * testable without a database. The Prisma layer persists the same shapes.
 */
import type { Cents } from "./money";

export type LedgerKind = "FUNDING" | "FEE" | "ADJUSTMENT";

export interface LedgerEventInput {
  kind: LedgerKind;
  /** Signed cents: positive = credit to the merchant; negative = debit. */
  amountCents: Cents;
  /** Idempotency key tying this event to the external event that caused it. */
  sourceEventId?: string;
}

/**
 * Net amount funded to the merchant, derived from the event log.
 * FUNDING credits the merchant; FEE debits Cadence's share; ADJUSTMENT corrects.
 */
export function deriveMerchantNetCents(events: LedgerEventInput[]): Cents {
  return events.reduce((sum, e) => {
    switch (e.kind) {
      case "FUNDING":
        return sum + e.amountCents;
      case "FEE":
        return sum - e.amountCents;
      case "ADJUSTMENT":
        return sum + e.amountCents;
      default: {
        const _exhaustive: never = e.kind;
        return _exhaustive;
      }
    }
  }, 0);
}

/**
 * Deduplicate events by sourceEventId so a replayed webhook never double-counts.
 * Events without a sourceEventId are always kept.
 */
export function dedupeBySource(events: LedgerEventInput[]): LedgerEventInput[] {
  const seen = new Set<string>();
  const out: LedgerEventInput[] = [];
  for (const e of events) {
    if (e.sourceEventId) {
      if (seen.has(e.sourceEventId)) continue;
      seen.add(e.sourceEventId);
    }
    out.push(e);
  }
  return out;
}
