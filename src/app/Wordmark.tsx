/** Noctua Pay brand lockup: the owl mark + wordmark ("Pay" in pipeline green). */
export function Wordmark({ size = 22 }: { size?: number }) {
  const mark = Math.round(size * 1.2);
  return (
    <span
      className="paid-wordmark"
      style={{ display: "inline-flex", alignItems: "center", gap: Math.round(size * 0.4) }}
    >
      <svg
        viewBox="0 0 48 48"
        width={mark}
        height={mark}
        role="img"
        aria-label="Noctua"
        style={{ color: "var(--paid)", flex: "none" }}
      >
        <g fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 13 L24 21 L39 13" />
          <circle cx="16" cy="28" r="6.4" />
          <circle cx="32" cy="28" r="6.4" />
        </g>
        <circle cx="16" cy="28" r="2.3" fill="currentColor" />
        <circle cx="32" cy="28" r="2.3" fill="currentColor" />
        <path d="M24 22 L20.5 26 L24 29 L27.5 26 Z" fill="currentColor" />
      </svg>
      <span style={{ fontSize: size }}>
        Noctua <span className="dot">Pay</span>
      </span>
    </span>
  );
}
