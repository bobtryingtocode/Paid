export const dynamic = "force-dynamic";

export default function PaySuccessPage() {
  return (
    <main style={{ maxWidth: 440, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
      <div
        className="paid-amount"
        style={{
          display: "inline-block",
          border: "3px solid var(--paid)",
          color: "var(--paid)",
          borderRadius: "var(--r-md)",
          padding: "8px 18px",
          transform: "rotate(-4deg)",
          textTransform: "uppercase",
          letterSpacing: "var(--ls-label)",
        }}
      >
        Paid
      </div>
      <h1 className="paid-h1" style={{ marginTop: 28 }}>You&apos;re all set<span style={{ color: "var(--paid)" }}>.</span></h1>
      <p className="paid-muted" style={{ marginTop: 8 }}>
        Your payment is processing. A receipt is on its way to your email.
      </p>
    </main>
  );
}
