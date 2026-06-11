import { ok, error } from "@/lib/http";
import { currentMerchantId } from "@/auth";
import { AgentJobInputSchema, QuotaError, executeAgentRun } from "@/agent/p2p/run";

export const runtime = "nodejs";
// Agent runs can take a while (extraction + multi-turn tool loop).
export const maxDuration = 300;

/**
 * POST /api/agent/p2p — the synchronous AI gateway for the procure-to-pay
 * invoice agent. Metered + gated by the merchant's subscription (402 when the
 * plan's token capacity is exhausted). On hosts with short function timeouts
 * (Netlify sync functions), prefer the async path: POST /api/agent/p2p/async.
 */
export async function POST(req: Request) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return error("unauthorized", "Sign in required", 401);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return error("invalid_json", "Request body must be valid JSON");
  }

  const parsed = AgentJobInputSchema.safeParse(raw);
  if (!parsed.success) {
    return error("validation_error", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  try {
    const result = await executeAgentRun(merchantId, parsed.data);
    return ok(result);
  } catch (err) {
    if (err instanceof QuotaError) return error("quota_exceeded", err.message, 402);
    const message = err instanceof Error ? err.message : "Agent run failed";
    return error("agent_error", message, 502);
  }
}
