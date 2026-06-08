"use client";

import { useState } from "react";
import type { PaymentOfferings } from "@/merchant/payment-settings";

export function PaymentSettingsForm({ initial }: { initial: PaymentOfferings }) {
  const [offerCard, setCard] = useState(initial.offerCard);
  const [offerPayOverTime, setPOT] = useState(initial.offerPayOverTime);
  const [offerSubscription, setSub] = useState(initial.offerSubscription);
  const [priceId, setPriceId] = useState(initial.subscriptionPriceId ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const res = await fetch("/api/merchants/me/payment-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          offerCard,
          offerPayOverTime,
          offerSubscription,
          subscriptionPriceId: offerSubscription ? priceId.trim() || null : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Could not save");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} style={{ display: "grid", gap: "1rem", maxWidth: 480 }}>
      <Toggle label="Pay over time (Klarna / Affirm)" hint="You're paid in full now; the partner carries the risk." checked={offerPayOverTime} onChange={setPOT} />
      <Toggle label="Card / debit (pay now)" hint="Standard one-time card payment." checked={offerCard} onChange={setCard} />
      <Toggle label="Subscription (ongoing service)" hint="Recurring billing via your Stripe Price." checked={offerSubscription} onChange={setSub} />

      {offerSubscription && (
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.9rem", color: "#555" }}>Stripe Price ID (on your connected account)</span>
          <input
            value={priceId}
            onChange={(e) => setPriceId(e.target.value)}
            placeholder="price_..."
            style={{ padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid #ccc" }}
          />
        </label>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <button type="submit" disabled={busy} style={{ padding: "0.6rem 1.1rem", borderRadius: 8, border: "none", background: "#111", color: "#fff", cursor: "pointer" }}>
          {busy ? "Saving…" : "Save"}
        </button>
        {saved && <span style={{ color: "#0a7d32" }}>Saved ✓</span>}
        {error && <span style={{ color: "#b00020" }}>{error}</span>}
      </div>
    </form>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 4 }} />
      <span>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <br />
        <span style={{ fontSize: "0.85rem", color: "#777" }}>{hint}</span>
      </span>
    </label>
  );
}
