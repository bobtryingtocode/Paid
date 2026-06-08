import { prisma } from "@/lib/prisma";

/**
 * A seller's buyer-facing payment offerings. The hosted pay page renders only
 * the enabled methods; payouts settle to the seller's Stripe Connect account.
 */
export interface PaymentOfferings {
  offerCard: boolean;
  offerPayOverTime: boolean;
  offerSubscription: boolean;
  subscriptionPriceId: string | null;
}

export const DEFAULT_OFFERINGS: PaymentOfferings = {
  offerCard: true,
  offerPayOverTime: true,
  offerSubscription: false,
  subscriptionPriceId: null,
};

export type PaymentMethodChoice = "card" | "pay_over_time" | "subscription";

/** Read a merchant's offerings, falling back to defaults if unset. */
export async function getPaymentOfferings(merchantId: string): Promise<PaymentOfferings> {
  const s = await prisma.merchantPaymentSettings.findUnique({ where: { merchantId } });
  if (!s) return DEFAULT_OFFERINGS;
  return {
    offerCard: s.offerCard,
    offerPayOverTime: s.offerPayOverTime,
    offerSubscription: s.offerSubscription,
    subscriptionPriceId: s.subscriptionPriceId,
  };
}

/** Create or update a merchant's offerings. */
export async function upsertPaymentOfferings(
  merchantId: string,
  data: PaymentOfferings,
): Promise<PaymentOfferings> {
  const s = await prisma.merchantPaymentSettings.upsert({
    where: { merchantId },
    create: { merchantId, ...data },
    update: data,
  });
  return {
    offerCard: s.offerCard,
    offerPayOverTime: s.offerPayOverTime,
    offerSubscription: s.offerSubscription,
    subscriptionPriceId: s.subscriptionPriceId,
  };
}

/** The list of methods a buyer may choose, given offerings (pure, testable). */
export function enabledMethods(o: PaymentOfferings): PaymentMethodChoice[] {
  const methods: PaymentMethodChoice[] = [];
  if (o.offerPayOverTime) methods.push("pay_over_time");
  if (o.offerCard) methods.push("card");
  if (o.offerSubscription && o.subscriptionPriceId) methods.push("subscription");
  return methods;
}

/** Whether a chosen method is currently offered (and configured). */
export function isMethodEnabled(o: PaymentOfferings, method: PaymentMethodChoice): boolean {
  return enabledMethods(o).includes(method);
}
