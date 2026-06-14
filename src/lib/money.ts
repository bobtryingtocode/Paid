/**
 * Money helpers. Noctua Pay stores all money as integer minor units (cents) and
 * never uses floating point for amounts. Rates are expressed in basis points
 * (1 bp = 0.01%). See docs/01-architecture.md ("Money & precision conventions").
 */

/** A non-negative integer count of cents. */
export type Cents = number;

/** Basis points: 10_000 bps = 100%. e.g. 4000 = 40%. */
export type Bps = number;

export function assertCents(value: number, label = "amount"): Cents {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer number of cents, got ${value}`);
  }
  if (value < 0) {
    throw new Error(`${label} must be non-negative, got ${value}`);
  }
  return value;
}

/** Apply a basis-point rate to a cents amount, rounding to the nearest cent. */
export function applyBps(amountCents: Cents, bps: Bps): Cents {
  assertCents(amountCents);
  if (!Number.isInteger(bps) || bps < 0) {
    throw new Error(`bps must be a non-negative integer, got ${bps}`);
  }
  return Math.round((amountCents * bps) / 10_000);
}

/** Format cents as a currency string for display only (never for storage/math). */
export function formatCents(amountCents: Cents, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

/** Parse a decimal currency input (e.g. "12.50") into integer cents. */
export function parseToCents(input: string): Cents {
  const normalized = input.trim().replace(/[$,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`invalid money input: ${input}`);
  }
  const [whole, frac = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return assertCents(cents);
}
