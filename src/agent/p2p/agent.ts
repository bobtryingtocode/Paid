import type Anthropic from "@anthropic-ai/sdk";
import { AGENT_MODEL, createMessage, messageText } from "@/agent/anthropic";
import type { CanonicalInvoice } from "@/agent/invoice/schema";
import { P2P_TOOLS, executeP2PTool, summarize, type RunContext } from "./tools";

const SYSTEM = `You are a procure-to-pay agent for project-cost invoices. Given a
normalized invoice, drive it to a financed, scheduled, and reconciled state:

1. Call recommend_payment_plan to compare Stripe, Klarna, and Afterpay.
2. Choose the best plan (lowest total cost unless a constraint says otherwise)
   and call approve_and_schedule with that providerId.
3. Call post_journal_entries to record the double-entry journal and reconcile
   outstanding credits and debits.
4. Briefly summarize for the user: the chosen provider, the repayment schedule,
   and the outstanding balance owed to the financer.

Use the tools to do the work; do not invent numbers.`;

const MAX_TURNS = 8;

export interface ProcureToPayResult {
  summary: string;
  context: ReturnType<typeof summarize>;
}

/**
 * Run the procure-to-pay agent over an already-extracted canonical invoice.
 * Uses the Messages API tool-use loop: Claude calls our in-process tools, we
 * execute them against the run context, and feed results back until it stops.
 */
export async function runProcureToPayAgent(
  invoice: CanonicalInvoice,
): Promise<ProcureToPayResult> {
  const ctx: RunContext = { invoice, state: "EXTRACTED", journal: [] };

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Here is the normalized invoice. Produce and execute a procure-to-pay plan.\n\n${JSON.stringify(
        invoice,
        null,
        2,
      )}`,
    },
  ];

  let summaryText = "";
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await createMessage({
      model: AGENT_MODEL,
      max_tokens: 8192,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: SYSTEM,
      tools: P2P_TOOLS,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      summaryText = messageText(response);
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const result = executeP2PTool(block.name, block.input, ctx);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  return { summary: summaryText, context: summarize(ctx) };
}
