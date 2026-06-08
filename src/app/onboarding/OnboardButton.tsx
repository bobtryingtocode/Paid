"use client";

import { useState } from "react";

export function OnboardButton({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/merchants/me/stripe/onboard", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Could not start onboarding");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start onboarding");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={start}
        disabled={busy}
        style={{
          padding: "0.65rem 1.1rem",
          borderRadius: 8,
          border: "none",
          background: "#635bff", // Stripe purple
          color: "#fff",
          fontSize: "1rem",
          cursor: "pointer",
        }}
      >
        {busy ? "…" : label}
      </button>
      {error && <p style={{ color: "#b00020" }}>{error}</p>}
    </div>
  );
}
