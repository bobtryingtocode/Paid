export default function Home() {
  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Cadence</h1>
      <p style={{ fontSize: "1.1rem", color: "#444", marginTop: 0 }}>
        Let your customers pay over time with Klarna — and get paid in full today.
      </p>
      <p style={{ color: "#666" }}>
        For small businesses selling to consumers: instead of just a credit-card
        charge, offer a Klarna pay-over-time plan at checkout. You&apos;re funded
        in full now, Klarna carries the risk, and there&apos;s no new bank or
        lender relationship to set up — it&apos;s a checkout choice, not a
        financing application. (Business buyers whose internal processes need net
        terms or a lender-style arrangement get the heavier B2B path.)
      </p>
      <p style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <a href="/login" style={{ color: "#111" }}>Sign in</a>
        <a href="/onboarding" style={{ color: "#111" }}>Get paid (Stripe)</a>
        <a href="/settings/payments" style={{ color: "#111" }}>Payment offerings</a>
        <a href="/agent" style={{ color: "#111" }}>Process an invoice</a>
        <a href="/billing" style={{ color: "#111" }}>Plans &amp; usage</a>
      </p>
      <ul style={{ color: "#666", lineHeight: 1.7 }}>
        <li>
          <code>POST /api/links</code> — create a payment link
        </li>
        <li>
          <code>GET /api/pay/:token</code> — public payer view
        </li>
        <li>
          <code>POST /api/pay/:token/checkout</code> — start checkout
        </li>
        <li>
          <code>POST /api/webhooks/stripe</code> — funding confirmation
        </li>
      </ul>
    </main>
  );
}
