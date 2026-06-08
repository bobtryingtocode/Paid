import { redirect } from "next/navigation";
import { currentMerchantId } from "@/auth";
import { getSubscriptionSummary } from "@/billing/entitlements";
import { InvoiceAgentClient } from "./InvoiceAgentClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const merchantId = await currentMerchantId();
  if (!merchantId) redirect("/login");

  const summary = await getSubscriptionSummary(merchantId);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <h1 style={{ fontSize: "1.8rem" }}>Process an invoice</h1>
      <p style={{ color: "#666" }}>
        Upload a project-cost invoice (PDF) or paste its text. The agent extracts it,
        recommends a financing plan with Stripe / Klarna / Afterpay, schedules the
        payments, and reconciles the journal.
      </p>

      {!summary.hasSubscription && (
        <p style={{ background: "#fff6e0", border: "1px solid #f0d98a", borderRadius: 8, padding: "0.75rem 1rem" }}>
          You don&apos;t have an active plan yet — runs will be blocked.{" "}
          <a href="/billing" style={{ color: "#111" }}>Choose a plan →</a>
        </p>
      )}

      <div style={{ marginTop: "1.5rem" }}>
        <InvoiceAgentClient />
      </div>
    </main>
  );
}
