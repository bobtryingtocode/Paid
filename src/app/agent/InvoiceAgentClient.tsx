"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";

type Mode = "pdf" | "text";

interface AgentResponse {
  invoice: {
    vendor: { name: string };
    invoiceNumber: string;
    totalCents: number;
    currency: string;
  };
  summary: string;
  context: {
    state: string;
    chosenProvider: string | null;
    totalRepaymentCents: number | null;
    scheduledPayments: { dueDate: string; amountCents: number }[];
    trialBalance: { outstandingFinancingPayableCents: number; balanced: boolean } | null;
  };
  usage: { totalTokens: number; remainingTokens: number };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result);
      const i = s.indexOf("base64,");
      resolve(i >= 0 ? s.slice(i + 7) : s);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function InvoiceAgentClient() {
  const [mode, setMode] = useState<Mode>("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState(false);
  const [result, setResult] = useState<AgentResponse | null>(null);

  /** Poll an async job until it settles (≤10 min, every 3s). */
  async function pollJob(jobId: string): Promise<AgentResponse> {
    for (let i = 0; i < 200; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const res = await fetch(`/api/agent/p2p/jobs/${jobId}`);
      if (!res.ok) throw new Error("Lost track of the agent run — try again");
      const job = await res.json();
      if (job.status === "done") return job.result as AgentResponse;
      if (job.status === "error") {
        if (job.error?.code === "quota_exceeded") setQuota(true);
        throw new Error(job.error?.message ?? "Agent run failed");
      }
    }
    throw new Error("Agent run timed out");
  }

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setQuota(false);
    setResult(null);
    setBusy(true);
    try {
      const body: Record<string, string> =
        mode === "pdf"
          ? { pdfBase64: file ? await fileToBase64(file) : "" }
          : { text };
      const payload = {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      } as const;

      // Prefer the async path (long-running, survives serverless sync caps);
      // 501 (unavailable) falls back to the sync route.
      let res = await fetch("/api/agent/p2p/async", payload);
      if (res.status === 501) res = await fetch("/api/agent/p2p", payload);

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      if (res.status === 402) {
        setQuota(true);
        throw new Error(data?.error?.message ?? "Quota exhausted");
      }
      if (!res.ok) throw new Error(data?.error?.message ?? "Agent run failed");

      setResult(res.status === 202 ? await pollJob(data.jobId) : (data as AgentResponse));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Agent run failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={run} style={{ display: "grid", gap: "0.75rem" }}>
        <div style={{ display: "flex", gap: "1rem" }}>
          <label><input type="radio" checked={mode === "pdf"} onChange={() => setMode("pdf")} /> PDF</label>
          <label><input type="radio" checked={mode === "text"} onChange={() => setMode("text")} /> Paste text</label>
        </div>

        {mode === "pdf" ? (
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        ) : (
          <textarea
            placeholder="Paste invoice text…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            style={{ padding: "0.6rem", borderRadius: 8, border: "1px solid #ccc", fontFamily: "inherit" }}
          />
        )}

        <button
          type="submit"
          disabled={busy || (mode === "pdf" ? !file : !text.trim())}
          style={{ padding: "0.65rem 1.1rem", borderRadius: 8, border: "none", background: "#111", color: "#fff", fontSize: "1rem", cursor: "pointer", justifySelf: "start" }}
        >
          {busy ? "Running agent…" : "Process invoice"}
        </button>
      </form>

      {error && (
        <p style={{ color: "#b00020", marginTop: "1rem" }}>
          {error}
          {quota && (
            <>
              {" "}
              <a href="/billing" style={{ color: "#111" }}>Upgrade your plan →</a>
            </>
          )}
        </p>
      )}

      {result && <Result result={result} />}
    </div>
  );
}

function Result({ result }: { result: AgentResponse }) {
  const { invoice, context, usage, summary } = result;
  const cur = invoice.currency;
  return (
    <div style={{ marginTop: "2rem", display: "grid", gap: "1.25rem" }}>
      <Card title="Invoice">
        <p style={{ margin: 0 }}>
          <strong>{invoice.vendor.name}</strong> · #{invoice.invoiceNumber} ·{" "}
          {formatCents(invoice.totalCents, cur)}
        </p>
      </Card>

      <Card title={`Recommended plan${context.chosenProvider ? `: ${context.chosenProvider}` : ""}`}>
        {context.totalRepaymentCents != null && (
          <p style={{ margin: "0 0 0.5rem" }}>
            Total repayment {formatCents(context.totalRepaymentCents, cur)}
          </p>
        )}
        {context.scheduledPayments.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#555" }}>
            {context.scheduledPayments.map((p, i) => (
              <li key={i}>{p.dueDate}: {formatCents(p.amountCents, cur)}</li>
            ))}
          </ul>
        )}
      </Card>

      {context.trialBalance && (
        <Card title="Reconciliation">
          <p style={{ margin: 0 }}>
            Outstanding to financer:{" "}
            {formatCents(context.trialBalance.outstandingFinancingPayableCents, cur)}
            {" · "}
            {context.trialBalance.balanced ? "balanced ✓" : "unbalanced ✗"}
            {" · "}state: {context.state}
          </p>
        </Card>
      )}

      {summary && (
        <Card title="Agent summary">
          <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "#444" }}>{summary}</p>
        </Card>
      )}

      <p style={{ color: "#888", fontSize: "0.85rem" }}>
        Used {usage.totalTokens.toLocaleString()} tokens this run ·{" "}
        {usage.remainingTokens.toLocaleString()} remaining this period
      </p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: "1px solid #e2e2e2", borderRadius: 12, padding: "1rem 1.25rem", background: "#fff" }}>
      <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem" }}>{title}</h3>
      {children}
    </section>
  );
}
