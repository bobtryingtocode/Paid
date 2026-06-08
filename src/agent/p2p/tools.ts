import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { CanonicalInvoice } from "@/agent/invoice/schema";
import { recommendPaymentPlan, type PaymentPlanRecommendation } from "@/domain/p2p/recommend";
import {
  getProvider,
  type PaymentPlanQuote,
  type ProviderId,
  type ScheduledPayment,
} from "@/domain/p2p/providers";
import {
  financingDrawdownEntry,
  invoiceReceivedEntry,
  reconcile,
  type JournalEntry,
  type TrialBalance,
} from "@/domain/accounting/journal";
import { canTransition, type P2PState } from "@/domain/p2p/workflow";

/** Mutable context threaded through the agent's tool calls for one invoice. */
export interface RunContext {
  invoice: CanonicalInvoice;
  state: P2PState;
  recommendation?: PaymentPlanRecommendation;
  chosen?: PaymentPlanQuote;
  scheduled?: ScheduledPayment[];
  journal: JournalEntry[];
}

const providerEnum = z.enum(["stripe", "klarna", "afterpay"]);

export const P2P_TOOLS: Anthropic.Tool[] = [
  {
    name: "recommend_payment_plan",
    description:
      "Quote all financing providers (Stripe, Klarna, Afterpay) for this invoice and return a ranked recommendation. Optionally bias toward a preferred provider.",
    input_schema: {
      type: "object",
      properties: {
        preferredProvider: { type: "string", enum: ["stripe", "klarna", "afterpay"] },
      },
    },
  },
  {
    name: "approve_and_schedule",
    description:
      "Approve a provider's plan and schedule its installment payments via the financing partner.",
    input_schema: {
      type: "object",
      properties: {
        providerId: { type: "string", enum: ["stripe", "klarna", "afterpay"] },
      },
      required: ["providerId"],
    },
  },
  {
    name: "post_journal_entries",
    description:
      "Record the double-entry journal for the approved plan (invoice received + financing drawdown) and return the reconciled trial balance.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_status",
    description: "Return the current procure-to-pay workflow state and key figures.",
    input_schema: { type: "object", properties: {} },
  },
];

function advance(ctx: RunContext, to: P2PState): void {
  // Advance through any intermediate legal states up to `to`.
  const order: P2PState[] = [
    "REQUESTED",
    "INVOICE_RECEIVED",
    "EXTRACTED",
    "PLAN_RECOMMENDED",
    "PLAN_APPROVED",
    "SCHEDULED",
    "RECONCILED",
    "CLOSED",
  ];
  let cur = ctx.state;
  const target = order.indexOf(to);
  while (order.indexOf(cur) < target) {
    const next = order[order.indexOf(cur) + 1];
    if (!canTransition(cur, next)) break;
    cur = next;
  }
  ctx.state = cur;
}

/** Execute one tool call against the run context; returns a JSON string result. */
export function executeP2PTool(name: string, input: unknown, ctx: RunContext): string {
  switch (name) {
    case "recommend_payment_plan": {
      const { preferredProvider } = z
        .object({ preferredProvider: providerEnum.optional() })
        .parse(input ?? {});
      const rec = recommendPaymentPlan(ctx.invoice, preferredProvider);
      ctx.recommendation = rec;
      advance(ctx, "PLAN_RECOMMENDED");
      return JSON.stringify(rec);
    }
    case "approve_and_schedule": {
      const { providerId } = z.object({ providerId: providerEnum }).parse(input);
      const quote = getProvider(providerId as ProviderId).quote({
        totalCents: ctx.invoice.totalCents,
        currency: ctx.invoice.currency,
      });
      ctx.chosen = quote;
      ctx.scheduled = getProvider(providerId as ProviderId).schedulePayments(quote);
      advance(ctx, "SCHEDULED");
      return JSON.stringify({ quote, scheduled: ctx.scheduled });
    }
    case "post_journal_entries": {
      if (!ctx.chosen) {
        return JSON.stringify({ error: "No approved plan; call approve_and_schedule first." });
      }
      ctx.journal = [
        invoiceReceivedEntry(ctx.invoice.totalCents),
        financingDrawdownEntry(ctx.invoice.totalCents, ctx.chosen.feeCents),
      ];
      const balance: TrialBalance = reconcile(ctx.journal);
      advance(ctx, "RECONCILED");
      return JSON.stringify({ entries: ctx.journal, trialBalance: balance });
    }
    case "get_status": {
      return JSON.stringify(summarize(ctx));
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

export function summarize(ctx: RunContext) {
  return {
    state: ctx.state,
    vendor: ctx.invoice.vendor.name,
    invoiceNumber: ctx.invoice.invoiceNumber,
    totalCents: ctx.invoice.totalCents,
    currency: ctx.invoice.currency,
    chosenProvider: ctx.chosen?.providerId ?? null,
    totalRepaymentCents: ctx.chosen?.totalRepaymentCents ?? null,
    scheduledPayments: ctx.scheduled ?? [],
    trialBalance: ctx.journal.length ? reconcile(ctx.journal) : null,
  };
}
