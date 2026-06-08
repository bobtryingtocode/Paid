import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentMerchantId } from "@/auth";
import { formatCents } from "@/lib/money";
import { CreateBillForm } from "./CreateBillForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const merchantId = await currentMerchantId();
  if (!merchantId) redirect("/login");

  const links = await prisma.paymentLink.findMany({
    where: { merchantId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <h1 style={{ fontSize: "1.8rem" }}>Bills</h1>
      <p style={{ color: "#666" }}>
        Create a bill for a completed service and email it to the customer with a
        payment link. Make sure your{" "}
        <a href="/onboarding" style={{ color: "#111" }}>Stripe onboarding</a> and{" "}
        <a href="/settings/payments" style={{ color: "#111" }}>payment offerings</a> are set.
      </p>

      <section style={{ margin: "1.5rem 0 2.5rem" }}>
        <CreateBillForm />
      </section>

      <h2 style={{ fontSize: "1.1rem" }}>Recent bills</h2>
      {links.length === 0 ? (
        <p style={{ color: "#777" }}>No bills yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.92rem" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#777" }}>
              <th style={th}>Description</th>
              <th style={th}>Amount</th>
              <th style={th}>Status</th>
              <th style={th}>Links</th>
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.id} style={{ borderTop: "1px solid #eee" }}>
                <td style={td}>{l.description || "—"}</td>
                <td style={td}>{formatCents(Number(l.amountCents), l.currency)}</td>
                <td style={td}>{l.status}</td>
                <td style={td}>
                  <a href={`${appUrl}/pay/${l.token}`} target="_blank" rel="noreferrer">pay</a>
                  {" · "}
                  <a href={`/api/links/${l.id}/bill`} target="_blank" rel="noreferrer">PDF</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

const th: React.CSSProperties = { padding: "0.4rem 0.5rem" };
const td: React.CSSProperties = { padding: "0.5rem 0.5rem" };
