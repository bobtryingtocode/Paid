import { ok, error } from "@/lib/http";
import { currentMerchantId } from "@/auth";
import { getJob } from "@/agent/p2p/jobs";

export const runtime = "nodejs";

/** GET /api/agent/p2p/jobs/:id — poll an async agent run (auth + ownership). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return error("unauthorized", "Sign in required", 401);

  const { id } = await params;
  const job = await getJob(id);
  if (!job || job.merchantId !== merchantId) {
    return error("not_found", "Job not found", 404);
  }

  // Don't echo merchantId back; the caller already is the owner.
  const { merchantId: _owner, ...view } = job;
  return ok({ id, ...view });
}
