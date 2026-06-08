import { formatCents } from "@/lib/money";

/**
 * Email delivery behind a single function. If RESEND_API_KEY is set, sends via
 * Resend (HTTP API, no SDK dependency) with the bill PDF attached; otherwise
 * logs a stub line so local dev works without an email provider. Swap the
 * transport here to use SES/Postmark/etc. without touching callers.
 */
export interface BillEmailInput {
  to: string;
  merchantName: string;
  billNumber: string;
  amountCents: number;
  currency: string;
  payUrl: string;
  pdf: Uint8Array;
}

export interface MailResult {
  delivered: boolean;
  provider: "resend" | "stub";
}

export async function sendBillEmail(input: BillEmailInput): Promise<MailResult> {
  const amount = formatCents(input.amountCents, input.currency);
  const subject = `Your bill from ${input.merchantName} — ${amount}`;
  const html =
    `<p>Hi,</p>` +
    `<p>${escapeHtml(input.merchantName)} sent you a bill for <strong>${amount}</strong>.</p>` +
    `<p><a href="${input.payUrl}">Pay your bill online</a> — pay over time with Klarna, by card, or set up a subscription.</p>` +
    `<p>Your bill is attached as a PDF.</p>`;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "bills@example.com";

  if (!apiKey) {
    console.log(`[mailer:stub] -> ${input.to} | ${subject} | ${input.payUrl}`);
    return { delivered: false, provider: "stub" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject,
      html,
      attachments: [
        {
          filename: `bill-${input.billNumber}.pdf`,
          content: Buffer.from(input.pdf).toString("base64"),
        },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Email send failed (${res.status})`);
  }
  return { delivered: true, provider: "resend" };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}
