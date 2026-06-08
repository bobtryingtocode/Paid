"use client";

import { useState } from "react";

export interface PlanView {
  slug: string;
  name: string;
  monthlyTokens: number;
  priceCents: number;
  current: boolean;
}

export function SubscribeButtons({ plans }: { plans: PlanView[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(slug: string) {
    setError(null);
    setBusy(slug);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planSlug: slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Checkout failed");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setBusy(null);
    }
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
        {plans.map((p) => (
          <div key={p.slug} style={{ border: "1px solid #e2e2e2", borderRadius: 12, padding: "1.25rem", background: "#fff" }}>
            <h3 style={{ margin: "0 0 0.25rem" }}>{p.name}</h3>
            <div style={{ fontSize: "1.5rem", fontWeight: 600 }}>${(p.priceCents / 100).toFixed(0)}<span style={{ fontSize: "0.9rem", color: "#777" }}>/mo</span></div>
            <p style={{ color: "#666", fontSize: "0.9rem" }}>
              {(p.monthlyTokens / 1_000_000).toLocaleString()}M Claude tokens / month
            </p>
            <button
              onClick={() => subscribe(p.slug)}
              disabled={busy !== null || p.current}
              style={{
                width: "100%",
                padding: "0.55rem",
                borderRadius: 8,
                border: "none",
                background: p.current ? "#bbb" : "#111",
                color: "#fff",
                cursor: p.current ? "default" : "pointer",
              }}
            >
              {p.current ? "Current plan" : busy === p.slug ? "…" : "Subscribe"}
            </button>
          </div>
        ))}
      </div>
      {error && <p style={{ color: "#b00020" }}>{error}</p>}
    </div>
  );
}
