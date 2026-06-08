import type { Merchant } from "@prisma/client";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

/**
 * Stripe Connect onboarding for merchants. Funds route partner → Stripe →
 * merchant via a connected (Express) account, so Cadence never takes custody
 * (see docs/01-architecture.md). This module creates the connected account,
 * mints hosted onboarding links, and reports onboarding status.
 */

/** Ensure the merchant has a Stripe Connect account; create + persist if missing. */
export async function ensureConnectAccount(merchant: Merchant): Promise<string> {
  if (merchant.stripeAccountId) return merchant.stripeAccountId;
  const account = await getStripe().accounts.create({
    type: "express",
    email: merchant.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });
  await prisma.merchant.update({
    where: { id: merchant.id },
    data: { stripeAccountId: account.id },
  });
  return account.id;
}

/** Create a hosted onboarding link for the connected account. */
export async function createOnboardingLink(accountId: string, appUrl: string): Promise<string> {
  const link = await getStripe().accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/onboarding?status=refresh`,
    return_url: `${appUrl}/onboarding?status=done`,
    type: "account_onboarding",
  });
  return link.url;
}

export interface ConnectStatus {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

export interface PayoutDestination {
  bankName: string | null;
  last4: string | null;
}

/**
 * The connected account's default payout bank — the "name of deposit". Stripe
 * holds the account/routing; we only surface bank name + last4 to the seller.
 * Returns null if not onboarded or no bank attached yet.
 */
export async function getPayoutDestination(merchant: Merchant): Promise<PayoutDestination | null> {
  if (!merchant.stripeAccountId) return null;
  const accounts = await getStripe().accounts.listExternalAccounts(merchant.stripeAccountId, {
    object: "bank_account",
    limit: 1,
  });
  const first = accounts.data[0];
  if (!first || first.object !== "bank_account") return null;
  return { bankName: first.bank_name ?? null, last4: first.last4 ?? null };
}

/** Read the merchant's Connect onboarding status from Stripe. */
export async function getConnectStatus(merchant: Merchant): Promise<ConnectStatus> {
  if (!merchant.stripeAccountId) {
    return { connected: false, chargesEnabled: false, payoutsEnabled: false, detailsSubmitted: false };
  }
  const account = await getStripe().accounts.retrieve(merchant.stripeAccountId);
  return {
    connected: true,
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
  };
}
