export default function Home() {
  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "80px 24px" }}>
      <div className="paid-wordmark" style={{ fontSize: 22 }}>
        Paid<span className="dot">.</span>
      </div>

      <p className="paid-eyebrow" style={{ marginTop: 48 }}>For small shops &amp; service businesses</p>
      <h1 className="paid-display" style={{ maxWidth: 760, marginTop: 12 }}>
        Get paid in full today<span style={{ color: "var(--paid)" }}>.</span> Let them pay over time<span style={{ color: "var(--paid)" }}>.</span>
      </h1>
      <p className="paid-muted" style={{ fontSize: 17, maxWidth: 620, marginTop: 16 }}>
        Send a customer a payment link. They choose how to pay — in full, or over
        time with Klarna. You&apos;re paid in full today; the financing partner
        carries the risk and the wait. You never become the bank.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 32 }}>
        <a className="paid-btn paid-btn--primary" href="/login">Sign in</a>
        <a className="paid-btn paid-btn--ghost" href="/bills">Send a bill</a>
        <a className="paid-btn paid-btn--ghost" href="/transactions">Transactions</a>
        <a className="paid-btn paid-btn--ghost" href="/billing">Plans &amp; usage</a>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginTop: 64,
        }}
      >
        {[
          { e: "Onboarding", t: "Get paid", d: "Connect Stripe so payouts land in your bank.", href: "/onboarding" },
          { e: "Offerings", t: "Set how they pay", d: "Klarna over time, card, or subscription.", href: "/settings/payments" },
          { e: "Agent", t: "Process an invoice", d: "Turn a PDF bill into a financing plan.", href: "/agent" },
        ].map((c) => (
          <a key={c.t} href={c.href} className="paid-card" style={{ padding: 20, display: "block", color: "inherit" }}>
            <div className="paid-eyebrow">{c.e}</div>
            <div className="paid-h2" style={{ marginTop: 8 }}>{c.t}</div>
            <p className="paid-muted" style={{ marginTop: 6 }}>{c.d}</p>
          </a>
        ))}
      </div>
    </main>
  );
}
