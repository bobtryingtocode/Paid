/**
 * The procure-to-pay workflow as a small state machine. Pure transition logic,
 * so the agent (and tests) can drive it deterministically.
 *
 *   REQUESTED → INVOICE_RECEIVED → EXTRACTED → PLAN_RECOMMENDED
 *             → PLAN_APPROVED → SCHEDULED → RECONCILED → CLOSED
 */
export type P2PState =
  | "REQUESTED"
  | "INVOICE_RECEIVED"
  | "EXTRACTED"
  | "PLAN_RECOMMENDED"
  | "PLAN_APPROVED"
  | "SCHEDULED"
  | "RECONCILED"
  | "CLOSED";

export const INITIAL_STATE: P2PState = "REQUESTED";

const TRANSITIONS: Record<P2PState, P2PState[]> = {
  REQUESTED: ["INVOICE_RECEIVED"],
  INVOICE_RECEIVED: ["EXTRACTED"],
  EXTRACTED: ["PLAN_RECOMMENDED"],
  PLAN_RECOMMENDED: ["PLAN_APPROVED"],
  PLAN_APPROVED: ["SCHEDULED"],
  SCHEDULED: ["RECONCILED"],
  RECONCILED: ["CLOSED"],
  CLOSED: [],
};

export function canTransition(from: P2PState, to: P2PState): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Advance the workflow, throwing on an illegal transition. */
export function transition(from: P2PState, to: P2PState): P2PState {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal procure-to-pay transition: ${from} -> ${to}`);
  }
  return to;
}

/** The single legal next state, or null at the terminal state. */
export function nextState(from: P2PState): P2PState | null {
  return TRANSITIONS[from][0] ?? null;
}
