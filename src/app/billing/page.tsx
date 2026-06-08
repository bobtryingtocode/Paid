import { redirect } from "next/navigation";
import { currentMerchantId } from "@/auth";
import { PLANS } from "@/billing/plans";
import { getSubscriptionSummary } from "@/billing/entitlements";
import { SubscribeButtons, type PlanView } from "./SubscribeButtons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const merchantId = await currentMerchantId();
  if (!merchantId) redirect("/login");

  const summary = await getSubscriptionSummary(merchantId);

  const plans: PlanView[] = Object.values(PLANS).map((p) => ({
    slug: p.slug,
    name: p.name,
    monthlyTokens: p.monthlyTokens,
    priceCents: p.priceCents,
    current: summary.planSlug === p.slug && summary.status === "ACTIVE",
  }));

  const pct =
    summary.allowanceTokens > 0
      ? Math.min(100, Math.round((summary.usedTokens / summary.allowanceTokens) * 100))
      : 0;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <h1 style={{ fontSize: "1.8rem" }}>Billing</h1>

      <section style={{ margin: "1.5rem 0 2.5rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Current usage</h2>
        {summary.hasSubscription ? (
          <>
            <p style={{ color: "#555", margin: "0.25rem 0" }}>
              {summary.planName} · {summary.status}
              {summary.currentPeriodEnd
                ? ` · renews ${summary.currentPeriodEnd.slice(0, 10)}`
                : ""}
            </p>
            <div style={{ background: "#eee", borderRadius: 999, height: 12, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? "#b00020" : "#111" }} />
            </div>
            <p style={{ color: "#666", fontSize: "0.9rem", marginTop: "0.5rem" }}>
              {summary.usedTokens.toLocaleString()} / {summary.allowanceTokens.toLocaleString()} tokens used
              {" · "}
              {summary.remainingTokens.toLocaleString()} remaining
              {pct >= 100 ? " — quota exhausted (runs are blocked until renewal)" : ""}
            </p>
          </>
        ) : (
          <p style={{ color: "#666" }}>No active subscription. Choose a plan below to start.</p>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: "1.1rem" }}>Plans</h2>
        <p style={{ color: "#666", fontSize: "0.9rem" }}>
          Capacity is metered in Claude tokens per month. Your customers never need their own
          API key — usage runs on the platform key and counts against your plan.
        </p>
        <SubscribeButtons plans={plans} />
      </section>
    </main>
  );
}
