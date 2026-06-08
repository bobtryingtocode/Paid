"use client";

import { useState } from "react";
import { parseToCents } from "@/lib/money";

interface SentResult {
  linkId: string;
  payUrl: string;
  delivered: boolean;
  provider: string;
}

export function CreateBillForm() {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SentResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    let amountCents: number;
    try {
      amountCents = parseToCents(amount);
    } catch {
      setError("Enter a valid amount, e.g. 250.00");
      return;
    }

    setBusy(true);
    try {
      const createRes = await fetch("/api/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountCents, currency: "usd", description }),
      });
      const link = await createRes.json();
      if (!createRes.ok) throw new Error(link?.error?.message ?? "Could not create bill");

      const sendRes = await fetch(`/api/links/${link.id}/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ customerEmail: email }),
      });
      const sent = await sendRes.json();
      if (!sendRes.ok) throw new Error(sent?.error?.message ?? "Could not send bill");

      setResult({ linkId: link.id, payUrl: sent.payUrl, delivered: sent.delivered, provider: sent.provider });
      setAmount("");
      setDescription("");
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} style={{ display: "grid", gap: "0.75rem", maxWidth: 460 }}>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount (e.g. 250.00)" required style={inp} />
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (e.g. Lawn care — June)" style={inp} />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Customer email" required style={inp} />
        <button type="submit" disabled={busy} style={btn}>{busy ? "Sending…" : "Create & email bill"}</button>
      </form>

      {error && <p style={{ color: "#b00020" }}>{error}</p>}
      {result && (
        <div style={{ marginTop: "1rem", border: "1px solid #cfe9d4", background: "#f3fbf5", borderRadius: 10, padding: "1rem" }}>
          <p style={{ margin: "0 0 0.5rem" }}>
            {result.delivered
              ? "✓ Bill emailed to the customer."
              : "✓ Bill created. Email is in stub mode (set RESEND_API_KEY to actually send)."}
          </p>
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            Payment link: <a href={result.payUrl}>{result.payUrl}</a>
            {" · "}
            <a href={`/api/links/${result.linkId}/bill`} target="_blank" rel="noreferrer">View PDF</a>
          </p>
        </div>
      )}
    </div>
  );
}

const inp: React.CSSProperties = { padding: "0.6rem 0.75rem", borderRadius: 8, border: "1px solid #ccc", fontSize: "1rem" };
const btn: React.CSSProperties = { padding: "0.65rem 1.1rem", borderRadius: 8, border: "none", background: "#111", color: "#fff", fontSize: "1rem", cursor: "pointer", justifySelf: "start" };
