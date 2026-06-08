import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentMerchantId } from "@/auth";
import { formatCents } from "@/lib/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const merchantId = await currentMerchantId();
  if (!merchantId) redirect("/login");

  const links = await prisma.paymentLink.findMany({
    where: { merchantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <h1 style={{ fontSize: "1.8rem" }}>Transactions</h1>
      <p style={{ color: "#666" }}>
        Each transaction has a PII- and audit-compliant journey. Click one to see
        its full event timeline and the deposit destination.
      </p>
      {links.length === 0 ? (
        <p style={{ color: "#777" }}>No transactions yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.92rem" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#777" }}>
              <th style={c}>Created</th>
              <th style={c}>Description</th>
              <th style={c}>Amount</th>
              <th style={c}>Status</th>
              <th style={c}></th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={c}>{l.createdAt.toISOString().slice(0, 10)}</td>
                <td style={c}>{l.description || "—"}</td>
                <td style={c}>{formatCents(Number(l.amountCents), l.currency)}</td>
                <td style={c}>{l.status}</td>
                <td style={c}><a href={`/transactions/${l.id}`}>journey →</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

const c: React.CSSProperties = { padding: "0.5rem" };
