"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";
import type { PaymentMethodChoice } from "@/merchant/payment-settings";

const LABELS: Record<PaymentMethodChoice, string> = {
  pay_over_time: "Pay over time with Klarna",
  card: "Pay now by card",
  subscription: "Start subscription",
};
const SUBLABELS: Record<PaymentMethodChoice, string> = {
  pay_over_time: "Split into installments — no card debt, instant approval at checkout",
  card: "One-time card or debit payment",
  subscription: "Recurring billing for ongoing service",
};

export function PayOptions({
  token,
  methods,
  amountCents,
  currency,
  merchantName,
  description,
}: {
  token: string;
  methods: PaymentMethodChoice[];
  amountCents: number;
  currency: string;
  merchantName: string;
  description: string | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pay(method: PaymentMethodChoice) {
    setError(null);
    setBusy(method);
    try {
      const res = await fetch(`/api/pay/${token}/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Could not start checkout");
      window.location.href = data.redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout");
      setBusy(null);
    }
  }

  return (
    <div>
      <p style={{ color: "#666", margin: "0 0 0.25rem" }}>Bill from {merchantName}</p>
      <div style={{ fontSize: "2rem", fontWeight: 700 }}>{formatCents(amountCents, currency)}</div>
      {description && <p style={{ color: "#555" }}>{description}</p>}

      <div style={{ display: "grid", gap: "0.75rem", marginTop: "1.5rem" }}>
        {methods.map((m) => (
          <button
            key={m}
            onClick={() => pay(m)}
            disabled={busy !== null}
            style={{
              textAlign: "left",
              padding: "0.9rem 1rem",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: m === "pay_over_time" ? "#ffb3c7" : "#fff", // Klarna pink for the hero option
              cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: 600 }}>{busy === m ? "…" : LABELS[m]}</div>
            <div style={{ fontSize: "0.85rem", color: "#666" }}>{SUBLABELS[m]}</div>
          </button>
        ))}
      </div>

      {error && <p style={{ color: "#b00020" }}>{error}</p>}
    </div>
  );
}
