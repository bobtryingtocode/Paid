import { prisma } from "@/lib/prisma";
import { error } from "@/lib/http";
import { currentMerchantId } from "@/auth";
import { buildBillPdf } from "@/bill/pdf";

export const runtime = "nodejs";

/** GET /api/links/:id/bill — download/preview the bill PDF (auth + ownership). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return error("unauthorized", "Sign in required", 401);

  const { id } = await params;
  const link = await prisma.paymentLink.findUnique({
    where: { id },
    include: { merchant: { select: { name: true } } },
  });
  if (!link || link.merchantId !== merchantId) {
    return error("not_found", "Payment link not found", 404);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const billNumber = link.id.slice(0, 8);
  const pdf = await buildBillPdf({
    merchantName: link.merchant.name,
    billNumber,
    description: link.description,
    amountCents: Number(link.amountCents),
    currency: link.currency,
    payUrl: `${appUrl}/pay/${link.token}`,
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="bill-${billNumber}.pdf"`,
    },
  });
}
