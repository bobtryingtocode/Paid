import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/auth/password";

/**
 * Auth.js (NextAuth v5) configuration. JWT sessions (no adapter tables); the
 * authenticated merchant's id is carried in the token and surfaced on the
 * session as `session.user.merchantId`. Credentials provider authenticates a
 * Merchant by email + password (hashed with scrypt; see src/auth/password.ts).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (creds) => {
        const email = typeof creds?.email === "string" ? creds.email : "";
        const password = typeof creds?.password === "string" ? creds.password : "";
        if (!email || !password) return null;

        const merchant = await prisma.merchant.findUnique({ where: { email } });
        if (!merchant?.passwordHash) return null;
        if (!verifyPassword(password, merchant.passwordHash)) return null;

        return { id: merchant.id, email: merchant.email, name: merchant.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.merchantId = user.id;
      return token;
    },
    session({ session, token }) {
      const merchantId = token.merchantId;
      if (session.user && typeof merchantId === "string") {
        (session.user as { merchantId?: string }).merchantId = merchantId;
      }
      return session;
    },
  },
});

/** The authenticated merchant id, or null if not signed in. Server-side only. */
export async function currentMerchantId(): Promise<string | null> {
  const session = await auth();
  const id = (session?.user as { merchantId?: string } | undefined)?.merchantId;
  return id ?? null;
}
