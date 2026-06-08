import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/http";

export const runtime = "nodejs";

/** GET /api/links/:id — link detail incl. funding status + ledger events. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const link = await prisma.paymentLink.findUnique({
    where: { id },
    include: {
      transaction: { include: { ledgerEvents: true } },
    },
  });
  if (!link) return error("not_found", "Payment link not found", 404);
  return ok(link);
}
