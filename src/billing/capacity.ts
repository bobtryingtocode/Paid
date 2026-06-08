/**
 * Pure capacity math for per-token metering with a hard block. Token counts fit
 * comfortably within Number.MAX_SAFE_INTEGER, so these operate on numbers; the
 * database stores cumulative usage as BigInt and converts at the boundary.
 */

/** Tokens left in the period (never negative). */
export function remainingTokens(allowanceTokens: number, usedTokens: number): number {
  return Math.max(0, allowanceTokens - usedTokens);
}

/**
 * Whether a new run may start. Hard block: allowed only while the period's used
 * tokens are still below the allowance. A run already in flight may overshoot
 * slightly (per-token cost isn't known until the run completes); the next run is
 * then blocked.
 */
export function hasCapacity(allowanceTokens: number, usedTokens: number): boolean {
  return usedTokens < allowanceTokens;
}
