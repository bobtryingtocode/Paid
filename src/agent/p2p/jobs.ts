import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Async agent-job records, stored in Postgres (Supabase) via Prisma so they work
 * on any host. (Previously Netlify Blobs, which only existed on Netlify.) The
 * enqueue route writes a "running" row, the post-response worker updates it to
 * "done"/"error", and the poll route reads it back (ownership-checked).
 */
export interface AgentJobRecord {
  status: "running" | "done" | "error";
  merchantId: string;
  createdAt: string;
  finishedAt?: string;
  result?: unknown;
  error?: { code: string; message: string };
}

const TO_DB = { running: "RUNNING", done: "DONE", error: "ERROR" } as const;
const FROM_DB = { RUNNING: "running", DONE: "done", ERROR: "error" } as const;

export async function putJob(id: string, record: AgentJobRecord): Promise<void> {
  const result =
    record.result === undefined
      ? Prisma.DbNull
      : (record.result as Prisma.InputJsonValue);
  const finishedAt = record.finishedAt ? new Date(record.finishedAt) : null;
  await prisma.agentJob.upsert({
    where: { id },
    create: {
      id,
      merchantId: record.merchantId,
      status: TO_DB[record.status],
      result,
      errorCode: record.error?.code ?? null,
      errorMessage: record.error?.message ?? null,
      createdAt: new Date(record.createdAt),
      finishedAt,
    },
    update: {
      status: TO_DB[record.status],
      result,
      errorCode: record.error?.code ?? null,
      errorMessage: record.error?.message ?? null,
      finishedAt,
    },
  });
}

export async function getJob(id: string): Promise<AgentJobRecord | null> {
  const job = await prisma.agentJob.findUnique({ where: { id } });
  if (!job) return null;
  return {
    status: FROM_DB[job.status],
    merchantId: job.merchantId,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString(),
    result: job.result ?? undefined,
    error: job.errorCode
      ? { code: job.errorCode, message: job.errorMessage ?? "" }
      : undefined,
  };
}
