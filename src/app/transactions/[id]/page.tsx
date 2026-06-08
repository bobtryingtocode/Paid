import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentMerchantId } from "@/auth";
import { formatCents } from "@/lib/money";
import { getJourney } from "@/audit/log";
import { getPayoutDestination } from "@/merchant/connect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TransactionJourneyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const merchantId = await currentMerchantId();
  if (!merchantId) redirect("/login");

  const { id } = await params;
  const link = await prisma.paymentLink.findUnique({
    where: { id },
    include: { merchant: true },
  });
  if (!link || link.merchantId !== merchantId) {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "3rem 1.5rem" }}>
        <h1>Not found</h1>
      </main>
    );
  }

  const [journey, deposit] = await Promise.all([
    getJourney(merchantId, id),
    getPayoutDestination(link.merchant),
  ]);

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <a href="/transactions" style={{ color: "#666", fontSize: "0.9rem" }}>← Transactions</a>
      <h1 style={{ fontSize: "1.6rem", marginTop: "0.5rem" }}>
        {link.description || "Transaction"} · {formatCents(Number(link.amountCents), link.currency)}
      </h1>
      <p style={{ color: "#666" }}>Status: {link.status} · Bill #{link.id.slice(0, 8)}</p>

      <section style={{ margin: "1.5rem 0" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Deposit destination</h2>
        {deposit ? (
          <p style={{ color: "#333" }}>
            {deposit.bankName ?? "Bank"} ····{deposit.last4 ?? "----"} (held by Stripe)
          </p>
        ) : (
          <p style={{ color: "#777" }}>No payout bank on file yet — finish Stripe onboarding.</p>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: "1.1rem" }}>Audit-compliant journey</h2>
        {journey.length === 0 ? (
          <p style={{ color: "#777" }}>No events recorded yet.</p>
        ) : (
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {journey.map((e) => (
              <li key={e.id} style={{ borderLeft: "2px solid #ddd", padding: "0.5rem 0 0.5rem 1rem", marginLeft: "0.5rem" }}>
                <div style={{ fontWeight: 600 }}>{e.type}</div>
                <div style={{ color: "#777", fontSize: "0.85rem" }}>
                  {e.createdAt.toISOString().replace("T", " ").slice(0, 19)} · {e.actor}
                  {e.amountCents != null ? ` · ${formatCents(Number(e.amountCents), e.currency ?? "usd")}` : ""}
                </div>
                {e.detail != null && (
                  <pre style={{ margin: "0.25rem 0 0", color: "#999", fontSize: "0.78rem" }}>
                    {JSON.stringify(e.detail)}
                  </pre>
                )}
              </li>
            ))}
          </ol>
        )}
        <p style={{ color: "#aaa", fontSize: "0.8rem", marginTop: "1rem" }}>
          Events are append-only and exclude customer PII. The same non-PII events
          are emitted to your Zapier automation.
        </p>
      </section>
    </main>
  );
}
