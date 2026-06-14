/**
 * Demo seed data so you can sign in and click through the whole flow locally.
 * Idempotent — safe to run repeatedly. Requires DATABASE_URL + a migrated DB:
 *
 *   npx prisma migrate dev      # create the schema
 *   npm run db:seed             # load this demo data
 *
 * Demo login:  demo@noctua.test  /  password123
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth/password";
import { PLANS } from "../src/billing/plans";

const prisma = new PrismaClient();

async function main() {
  // Demo merchant
  const merchant = await prisma.merchant.upsert({
    where: { email: "demo@noctua.test" },
    update: {},
    create: {
      name: "Demo Co",
      email: "demo@noctua.test",
      passwordHash: hashPassword("password123"),
    },
  });

  // Active Pro subscription with a 30-day current period
  const periodStart = new Date();
  const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 3600 * 1000);
  const subscription = await prisma.subscription.upsert({
    where: { merchantId: merchant.id },
    update: { status: "ACTIVE", planSlug: "pro", currentPeriodStart: periodStart, currentPeriodEnd: periodEnd },
    create: {
      merchantId: merchant.id,
      planSlug: "pro",
      status: "ACTIVE",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
  });

  // A usage period showing ~15% consumed, so the usage bar isn't empty
  const used = Math.round(PLANS.pro.monthlyTokens * 0.15);
  await prisma.usagePeriod.upsert({
    where: { subscriptionId_periodStart: { subscriptionId: subscription.id, periodStart } },
    update: {},
    create: {
      subscriptionId: subscription.id,
      periodStart,
      periodEnd,
      inputTokens: BigInt(Math.round(used * 0.8)),
      outputTokens: BigInt(Math.round(used * 0.2)),
      totalTokens: BigInt(used),
      runs: 3,
    },
  });

  // Buyer-facing payment offerings (pay-over-time + card; subscription off)
  await prisma.merchantPaymentSettings.upsert({
    where: { merchantId: merchant.id },
    update: {},
    create: {
      merchantId: merchant.id,
      offerCard: true,
      offerPayOverTime: true,
      offerSubscription: false,
    },
  });

  // A sample open payment link (Model A)
  await prisma.paymentLink.upsert({
    where: { token: "demo-link-token" },
    update: {},
    create: {
      merchantId: merchant.id,
      model: "CONSUMER",
      amountCents: BigInt(125_00),
      currency: "usd",
      description: "Demo: studio session deposit",
      status: "OPEN",
      token: "demo-link-token",
    },
  });

  console.log("Seeded demo data:");
  console.log("  merchant:", merchant.email, "(password: password123)");
  console.log("  plan:", subscription.planSlug, "ACTIVE");
  console.log("  sample payment link token:", "demo-link-token");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
