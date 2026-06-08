import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateLinkToken } from "@/lib/token";
import { ok, error } from "@/lib/http";

export const runtime = "nodejs";

const CreateLinkSchema = z.object({
  // TODO(auth): derive merchantId from the authenticated session instead of the body.
  merchantId: z.string().min(1),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3).default("usd"),
  description: z.string().max(500).optional(),
  expiresAt: z.coerce.date().optional(),
});

/** POST /api/links — create a Model A payment link. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("invalid_json", "Request body must be valid JSON");
  }

  const parsed = CreateLinkSchema.safeParse(body);
  if (!parsed.success) {
    return error("validation_error", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { merchantId, amountCents, currency, description, expiresAt } = parsed.data;

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) return error("merchant_not_found", "Unknown merchant", 404);

  const link = await prisma.paymentLink.create({
    data: {
      merchantId,
      model: "CONSUMER",
      amountCents: BigInt(amountCents),
      currency,
      description,
      expiresAt,
      status: "OPEN",
      token: generateLinkToken(),
    },
  });

  return ok(link, { status: 201 });
}

/** GET /api/links — list the merchant's links. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  // TODO(auth): scope to the authenticated merchant rather than a query param.
  const merchantId = url.searchParams.get("merchantId");
  if (!merchantId) return error("validation_error", "merchantId is required");

  const links = await prisma.paymentLink.findMany({
    where: { merchantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return ok({ links });
}
