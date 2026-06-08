import { redirect } from "next/navigation";
import { currentMerchantId } from "@/auth";
import { getPaymentOfferings } from "@/merchant/payment-settings";
import { PaymentSettingsForm } from "./PaymentSettingsForm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PaymentSettingsPage() {
  const merchantId = await currentMerchantId();
  if (!merchantId) redirect("/login");

  const offerings = await getPaymentOfferings(merchantId);

  return (
    <main style={{ maxWidth: 620, margin: "0 auto", padding: "3rem 1.5rem" }}>
      <h1 style={{ fontSize: "1.8rem" }}>Payment offerings</h1>
      <p style={{ color: "#666" }}>
        Choose what your customers can do on the bill payment page. They&apos;ll see
        only the options you enable here. Payouts settle to your connected Stripe
        account — finish{" "}
        <a href="/onboarding" style={{ color: "#111" }}>Stripe onboarding</a> first
        so you can accept payments.
      </p>
      <div style={{ marginTop: "1.5rem" }}>
        <PaymentSettingsForm initial={offerings} />
      </div>
    </main>
  );
}
