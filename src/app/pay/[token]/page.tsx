import { prisma } from "@/lib/prisma";
import { enabledMethods, getPaymentOfferings } from "@/merchant/payment-settings";
import { PayOptions } from "./PayOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 460, margin: "0 auto", padding: "4rem 1.5rem" }}>{children}</main>
  );
}

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await prisma.paymentLink.findUnique({
    where: { token },
    include: { merchant: { select: { name: true, stripeAccountId: true } } },
  });

  if (!link) {
    return <Shell><h1>Link not found</h1><p style={{ color: "#666" }}>This payment link doesn&apos;t exist.</p></Shell>;
  }
  if (link.status !== "OPEN") {
    return <Shell><h1>Not available</h1><p style={{ color: "#666" }}>This bill is {link.status.toLowerCase()}.</p></Shell>;
  }
  if (link.expiresAt && link.expiresAt < new Date()) {
    return <Shell><h1>Link expired</h1><p style={{ color: "#666" }}>Please ask the business for a new link.</p></Shell>;
  }

  const offerings = await getPaymentOfferings(link.merchantId);
  const methods = enabledMethods(offerings);
  const canAccept = Boolean(link.merchant.stripeAccountId) && methods.length > 0;

  if (!canAccept) {
    return (
      <Shell>
        <h1>Not ready yet</h1>
        <p style={{ color: "#666" }}>
          {link.merchant.name} hasn&apos;t finished setting up payments. Please check back soon.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <PayOptions
        token={link.token}
        methods={methods}
        amountCents={Number(link.amountCents)}
        currency={link.currency}
        merchantName={link.merchant.name}
        description={link.description}
      />
      <p style={{ color: "#aaa", fontSize: "0.8rem", marginTop: "2rem" }}>
        Secured by Stripe. {link.merchant.name} is paid directly.
      </p>
    </Shell>
  );
}
