/**
 * Netlify Background Function (the -background suffix is load-bearing): runs a
 * procure-to-pay agent job for up to 15 minutes — past the ~10-26s cap that
 * kills the sync route on Netlify. Invoked by POST /api/agent/p2p/async with an
 * internal bearer (AUTH_SECRET); never called by browsers directly. Writes the
 * job result to Netlify Blobs for the polling route to read.
 */
import { executeAgentRun, QuotaError } from "../../src/agent/p2p/run";
import { putJob } from "../../src/agent/p2p/jobs";

export default async (req: Request) => {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.AUTH_SECRET ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }

  let payload: { jobId: string; merchantId: string; input: unknown };
  try {
    payload = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  const { jobId, merchantId, input } = payload;
  if (!jobId || !merchantId) return new Response("bad request", { status: 400 });

  const base = { merchantId, createdAt: new Date().toISOString() };
  try {
    // `input` was validated by the enqueue route; run it.
    const result = await executeAgentRun(merchantId, input as Parameters<typeof executeAgentRun>[1]);
    await putJob(jobId, { ...base, status: "done", finishedAt: new Date().toISOString(), result });
  } catch (err) {
    const code = err instanceof QuotaError ? "quota_exceeded" : "agent_error";
    const message = err instanceof Error ? err.message : "Agent run failed";
    await putJob(jobId, {
      ...base,
      status: "error",
      finishedAt: new Date().toISOString(),
      error: { code, message },
    });
  }

  return new Response("ok");
};
