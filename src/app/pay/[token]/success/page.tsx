export const dynamic = "force-dynamic";

export default function PaySuccessPage() {
  return (
    <main style={{ maxWidth: 460, margin: "0 auto", padding: "5rem 1.5rem", textAlign: "center" }}>
      <div style={{ fontSize: "3rem" }}>✓</div>
      <h1 style={{ fontSize: "1.6rem" }}>Payment started</h1>
      <p style={{ color: "#666" }}>
        Thanks! Your payment is being processed. You&apos;ll receive a receipt by email.
      </p>
    </main>
  );
}
