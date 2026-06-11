import { getStore } from "@netlify/blobs";

/**
 * Async agent-job records, stored in Netlify Blobs (available automatically in
 * functions running on Netlify; absent in local dev — callers should treat
 * "blobs unavailable" as "async mode unsupported" and fall back to sync).
 */
export interface AgentJobRecord {
  status: "running" | "done" | "error";
  merchantId: string;
  createdAt: string;
  finishedAt?: string;
  result?: unknown;
  error?: { code: string; message: string };
}

const STORE = "agent-jobs";

export function jobsAvailable(): boolean {
  // Set by the Netlify build/runtime; absent in plain `next dev`.
  return process.env.NETLIFY === "true" || Boolean(process.env.NETLIFY_BLOBS_CONTEXT);
}

export async function putJob(id: string, record: AgentJobRecord): Promise<void> {
  await getStore(STORE).setJSON(id, record);
}

export async function getJob(id: string): Promise<AgentJobRecord | null> {
  const data = await getStore(STORE).get(id, { type: "json" });
  return (data as AgentJobRecord | null) ?? null;
}
