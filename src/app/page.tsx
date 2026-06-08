export default function Home() {
  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>Cadence</h1>
      <p style={{ fontSize: "1.1rem", color: "#444", marginTop: 0 }}>
        Get the maker paid now. Let the business repay as it sells.
      </p>
      <p style={{ color: "#666" }}>
        Phase 1 (Model A): a merchant creates a payment link, the customer pays
        over time via Klarna/Affirm through Stripe, and the merchant is funded in
        full. See <code>docs/</code> for the architecture and{" "}
        <code>src/app/api/</code> for the API.
      </p>
      <p style={{ display: "flex", gap: "1rem" }}>
        <a href="/login" style={{ color: "#111" }}>Sign in</a>
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
