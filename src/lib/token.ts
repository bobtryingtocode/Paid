import { randomBytes } from "node:crypto";

/**
 * Generate an unguessable, URL-safe token for a public payment link.
 * 24 bytes → 32 base64url chars of entropy.
 */
export function generateLinkToken(): string {
  return randomBytes(24).toString("base64url");
}
