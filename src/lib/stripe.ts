import Stripe from "stripe";

/**
 * Server-only Stripe client, lazily constructed. The secret key never reaches
 * the browser bundle — this module must only be imported from server code
 * (route handlers, server actions). See docs/01-architecture.md ("Trust
 * boundaries"). Construction is deferred so importing a route at build time
 * (page-data collection) never requires the secret to be present.
 */
let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (client) return client;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  client = new Stripe(secretKey, {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });
  return client;
}
