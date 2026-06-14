import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { ok, error } from "@/lib/http";
import { currentMerchantId } from "@/auth";
import { AgentJobInputSchema, QuotaError, executeAgentRun } from "@/agent/p2p/run";
import { checkCapacity } from "@/billing/entitlements";
import { putJob } from "@/agent/p2p/jobs";

export const runtime = "nodejs";
// The agent loop (extraction + multi-turn tool use) can run for minutes; let the
// post-response work use the full serverless budget. Requires a plan that allows
// long functions (Vercel Pro is 300s).
export const maxDuration = 300;

/**
 * POST /api/agent/p2p/async — enqueue a procure-to-pay agent run. Pre-checks
 * capacity (fast 402), records a "running" job in Postgres, then runs the agent
 * AFTER the response is sent (Next.js `after`, Node runtime) and writes the
 * result/error back. Poll the job at GET /api/agent/p2p/jobs/:id. The sync route
 * (/api/agent/p2p) remains available for hosts with short function timeouts.
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

  // Fail fast before enqueueing anything.
  const capacity = await checkCapacity(merchantId);
  if (!capacity.allowed) {
    return error("quota_exceeded", capacity.reason ?? "No capacity", 402);
  }

  const jobId = randomUUID();
  const createdAt = new Date().toISOString();
  await putJob(jobId, { status: "running", merchantId, createdAt });

  after(async () => {
    try {
      const result = await executeAgentRun(merchantId, parsed.data);
      await putJob(jobId, {
        status: "done",
        merchantId,
        createdAt,
        finishedAt: new Date().toISOString(),
        result,
      });
    } catch (err) {
      const code = err instanceof QuotaError ? "quota_exceeded" : "agent_error";
      const message = err instanceof Error ? err.message : "Agent run failed";
      await putJob(jobId, {
        status: "error",
        merchantId,
        createdAt,
        finishedAt: new Date().toISOString(),
        error: { code, message },
      });
    }
  });

  return ok({ jobId, status: "running" }, { status: 202 });
}
