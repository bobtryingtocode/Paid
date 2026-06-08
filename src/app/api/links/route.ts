import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateLinkToken } from "@/lib/token";
import { ok, error } from "@/lib/http";
import { currentMerchantId } from "@/auth";

export const runtime = "nodejs";

const CreateLinkSchema = z.object({
  amountCents: z.number().int().positive(),
  currency: z.string().length(3).default("usd"),
  description: z.string().max(500).optional(),
  expiresAt: z.coerce.date().optional(),
});

/** POST /api/links — create a Model A payment link. */
export async function POST(req: Request) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return error("unauthorized", "Sign in required", 401);

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
  const { amountCents, currency, description, expiresAt } = parsed.data;

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

/** GET /api/links — list the authenticated merchant's links. */
export async function GET() {
  const merchantId = await currentMerchantId();
  if (!merchantId) return error("unauthorized", "Sign in required", 401);

  const links = await prisma.paymentLink.findMany({
    where: { merchantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return ok({ links });
}
