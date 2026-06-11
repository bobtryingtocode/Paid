"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";
import type { PaymentMethodChoice } from "@/merchant/payment-settings";

const LABELS: Record<PaymentMethodChoice, string> = {
  pay_over_time: "Pay over time",
  card: "Pay in full",
  subscription: "Subscribe",
};
const SUBLABELS: Record<PaymentMethodChoice, string> = {
  pay_over_time: "Klarna · Pay in 4, every 2 weeks · 0% interest",
  card: "Card or debit, today",
  subscription: "Ongoing service, billed automatically",
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
      if (!res.ok) throw new Error(data?.error?.message ?? "Couldn't start checkout");
      window.location.href = data.redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start checkout");
      setBusy(null);
    }
  }

  return (
    <div>
      <p className="paid-eyebrow">Bill from {merchantName}</p>
      <div className="paid-amount" style={{ fontSize: "var(--fs-amount-hero)", marginTop: 8, color: "var(--ink)" }}>
        {formatCents(amountCents, currency)}
      </div>
      {description && <p className="paid-muted" style={{ marginTop: 4 }}>{description}</p>}

      <div style={{ display: "grid", gap: 12, marginTop: 28 }}>
        {methods.map((m) => (
          <button
            key={m}
            onClick={() => pay(m)}
            disabled={busy !== null}
            className="paid-card"
            style={{
              textAlign: "left",
              padding: "16px 18px",
              cursor: "pointer",
              borderColor: m === "pay_over_time" ? "var(--paid)" : "var(--border)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700 }}>{busy === m ? "…" : LABELS[m]}</span>
              <span aria-hidden style={{ color: "var(--paid)" }}>›</span>
            </div>
            <div className="paid-muted" style={{ fontSize: "var(--fs-small)", marginTop: 4 }}>{SUBLABELS[m]}</div>
          </button>
        ))}
      </div>

      {error && <p style={{ color: "var(--alert)", marginTop: 12 }}>{error}</p>}
    </div>
  );
}
