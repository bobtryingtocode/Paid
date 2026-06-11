import { prisma } from "@/lib/prisma";
import { enabledMethods, getPaymentOfferings } from "@/merchant/payment-settings";
import { PayOptions } from "./PayOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  // The buyer checkout is a single calm column (~440px).
  return (
    <main style={{ maxWidth: 440, margin: "0 auto", padding: "56px 24px" }}>
      <div className="paid-wordmark" style={{ fontSize: 18, marginBottom: 32 }}>
        Paid<span className="dot">.</span>
      </div>
      {children}
    </main>
  );
}

export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await prisma.paymentLink.findUnique({
    where: { token },
    include: { merchant: { select: { name: true, stripeAccountId: true } } },
  });

  if (!link) {
    return <Shell><h1 className="paid-h1">Link not found</h1><p className="paid-muted" style={{ marginTop: 8 }}>This payment link doesn&apos;t exist.</p></Shell>;
  }
  if (link.status !== "OPEN") {
    return <Shell><h1 className="paid-h1">Already settled</h1><p className="paid-muted" style={{ marginTop: 8 }}>This bill is {link.status.toLowerCase()}.</p></Shell>;
  }
  if (link.expiresAt && link.expiresAt < new Date()) {
    return <Shell><h1 className="paid-h1">Link expired</h1><p className="paid-muted" style={{ marginTop: 8 }}>Ask the business for a new link.</p></Shell>;
  }

  const offerings = await getPaymentOfferings(link.merchantId);
  const methods = enabledMethods(offerings);
  const canAccept = Boolean(link.merchant.stripeAccountId) && methods.length > 0;

  if (!canAccept) {
    return (
      <Shell>
        <h1 className="paid-h1">Not ready yet</h1>
        <p className="paid-muted" style={{ marginTop: 8 }}>
          {link.merchant.name} is still setting up payments. Check back soon.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="paid-card" style={{ padding: 24 }}>
        <PayOptions
          token={link.token}
          methods={methods}
          amountCents={Number(link.amountCents)}
          currency={link.currency}
          merchantName={link.merchant.name}
          description={link.description}
        />
      </div>
      <p className="paid-muted" style={{ fontSize: "var(--fs-small)", marginTop: 16, textAlign: "center" }}>
        Secured by Stripe. {link.merchant.name} is paid in full today.
      </p>
    </Shell>
  );
}
