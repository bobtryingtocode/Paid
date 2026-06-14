import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentMerchantId } from "@/auth";
import { getConnectStatus } from "@/merchant/connect";
import { OnboardButton } from "./OnboardButton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function row(label: string, done: boolean) {
  return (
    <li style={{ color: done ? "#0a7d32" : "#777" }}>
      {done ? "✓" : "○"} {label}
    </li>
  );
}

export default async function OnboardingPage() {
  const merchantId = await currentMerchantId();
  if (!merchantId) redirect("/login");

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) redirect("/login");

  const status = await getConnectStatus(merchant);
  const fullyOnboarded = status.chargesEnabled && status.payoutsEnabled;

  return (
    <main style={{ maxWidth: 620, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <h1 style={{ fontSize: "1.8rem" }}>Get paid — Stripe onboarding</h1>
      <p style={{ color: "#666" }}>
        Connect a Stripe account so funds can route <code>partner → Stripe → you</code>.
        Noctua Pay never holds your money.
      </p>

      <ul style={{ lineHeight: 1.9, listStyle: "none", padding: 0, margin: "1.5rem 0" }}>
        {row("Stripe account created", status.connected)}
        {row("Details submitted", status.detailsSubmitted)}
        {row("Charges enabled", status.chargesEnabled)}
        {row("Payouts enabled", status.payoutsEnabled)}
      </ul>

      {fullyOnboarded ? (
        <p style={{ color: "#0a7d32", fontWeight: 600 }}>
          ✓ You&apos;re fully onboarded and ready to receive payouts.
        </p>
      ) : (
        <OnboardButton
          label={status.connected ? "Continue Stripe onboarding" : "Start Stripe onboarding"}
        />
      )}
    </main>
  );
}
