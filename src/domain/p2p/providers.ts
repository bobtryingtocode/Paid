import { applyBps, type Cents } from "@/lib/money";

/**
 * Financing providers behind one interface (see docs/06-partner-integrations.md
 * for the orchestration principle). Each provider produces a deterministic
 * quote and a stub scheduling result — we have no live API credentials in this
 * environment, so `schedulePayments` simulates the partner call. Swapping a stub
 * for a real API later means implementing this interface; nothing else changes.
 */
export type ProviderId = "stripe" | "klarna" | "afterpay";

export type PlanShape = "pay_in_4" | "monthly_3";

export interface QuoteInput {
  totalCents: Cents;
  currency: string;
  /** ISO YYYY-MM-DD; first installment date. Defaults to today. */
  startDate?: string;
}

export interface Installment {
  dueDate: string; // ISO YYYY-MM-DD
  amountCents: Cents;
}

export interface PaymentPlanQuote {
  providerId: ProviderId;
  providerName: string;
  shape: PlanShape;
  installments: Installment[];
  feeCents: Cents; // financing fee added on top of the invoice total
  totalRepaymentCents: Cents; // total + fee
}

export interface ScheduledPayment extends Installment {
  externalId: string;
  status: "scheduled";
}

export interface FinancingProvider {
  id: ProviderId;
  displayName: string;
  quote(input: QuoteInput): PaymentPlanQuote;
  /** Stub: simulate registering the plan with the partner. */
  schedulePayments(quote: PaymentPlanQuote): ScheduledPayment[];
}

// --- date helpers (UTC, ISO YYYY-MM-DD) ---------------------------------------

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}
function addMonths(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return isoDate(d);
}

/**
 * Split `totalCents` into `n` installments, distributing the rounding remainder
 * into the final installment so the parts always sum exactly to the total.
 */
function splitEvenly(totalCents: Cents, n: number, dates: string[]): Installment[] {
  const base = Math.floor(totalCents / n);
  const installments: Installment[] = [];
  let allocated = 0;
  for (let i = 0; i < n; i++) {
    const amount = i === n - 1 ? totalCents - allocated : base;
    allocated += amount;
    installments.push({ dueDate: dates[i], amountCents: amount });
  }
  return installments;
}

function stubSchedule(quote: PaymentPlanQuote): ScheduledPayment[] {
  return quote.installments.map((inst, i) => ({
    ...inst,
    externalId: `${quote.providerId}_sched_${i + 1}`,
    status: "scheduled",
  }));
}

/** Klarna / Afterpay pay-in-4: 4 biweekly installments, no financing fee. */
function payIn4Provider(id: "klarna" | "afterpay", name: string): FinancingProvider {
  return {
    id,
    displayName: name,
    quote(input) {
      const start = input.startDate ?? isoDate(new Date());
      const dates = [0, 14, 28, 42].map((d) => addDays(start, d));
      return {
        providerId: id,
        providerName: name,
        shape: "pay_in_4",
        installments: splitEvenly(input.totalCents, 4, dates),
        feeCents: 0,
        totalRepaymentCents: input.totalCents,
      };
    },
    schedulePayments: stubSchedule,
  };
}

/** Stripe (via embedded financing): 3 monthly installments with a financing fee. */
const STRIPE_FEE_BPS = 600; // 6.00% financing fee, illustrative
const stripeProvider: FinancingProvider = {
  id: "stripe",
  displayName: "Stripe",
  quote(input) {
    const start = input.startDate ?? isoDate(new Date());
    const fee = applyBps(input.totalCents, STRIPE_FEE_BPS);
    const total = input.totalCents + fee;
    const dates = [0, 1, 2].map((m) => addMonths(start, m));
    return {
      providerId: "stripe",
      providerName: "Stripe",
      shape: "monthly_3",
      installments: splitEvenly(total, 3, dates),
      feeCents: fee,
      totalRepaymentCents: total,
    };
  },
  schedulePayments: stubSchedule,
};

export const PROVIDERS: Record<ProviderId, FinancingProvider> = {
  klarna: payIn4Provider("klarna", "Klarna"),
  afterpay: payIn4Provider("afterpay", "Afterpay"),
  stripe: stripeProvider,
};

export function getProvider(id: ProviderId): FinancingProvider {
  return PROVIDERS[id];
}
