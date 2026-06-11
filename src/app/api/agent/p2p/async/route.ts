import { randomUUID } from "node:crypto";
import { ok, error } from "@/lib/http";
import { currentMerchantId } from "@/auth";
import { AgentJobInputSchema } from "@/agent/p2p/run";
import { checkCapacity } from "@/billing/entitlements";
import { jobsAvailable, putJob } from "@/agent/p2p/jobs";

export const runtime = "nodejs";

/**
 * POST /api/agent/p2p/async — enqueue an agent run as a Netlify Background
 * Function (15-min limit vs the ~10-26s sync cap). Pre-checks capacity (fast
 * 402), records a "running" job in Netlify Blobs, and invokes the background
 * function with an internal bearer (AUTH_SECRET). Poll the job at
 * GET /api/agent/p2p/jobs/:id. Returns 501 off-Netlify so clients fall back
 * to the sync route.
 */
export async function POST(req: Request) {
  if (!jobsAvailable()) {
    return error("async_unavailable", "Async agent runs require the Netlify runtime", 501);
  }

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
  await putJob(jobId, {
    status: "running",
    merchantId,
    createdAt: new Date().toISOString(),
  });

  const origin = new URL(req.url).origin;
  const res = await fetch(`${origin}/.netlify/functions/agent-run-background`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.AUTH_SECRET ?? ""}`,
    },
    body: JSON.stringify({ jobId, merchantId, input: parsed.data }),
  });
  // Background functions ack with 202 and keep running.
  if (res.status !== 202 && !res.ok) {
    return error("enqueue_failed", `Background function returned ${res.status}`, 502);
  }

  return ok({ jobId, status: "running" }, { status: 202 });
}
