import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/http";
import { hashPassword } from "@/auth/password";

export const runtime = "nodejs";

const BodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/** POST /api/auth/signup — create a merchant account with a hashed password. */
export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return error("invalid_json", "Request body must be valid JSON");
  }
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return error("validation_error", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.merchant.findUnique({ where: { email } });
  if (existing) return error("email_taken", "An account with that email already exists", 409);

  const merchant = await prisma.merchant.create({
    data: { name, email, passwordHash: hashPassword(password) },
  });
  return ok({ id: merchant.id, email: merchant.email }, { status: 201 });
}
