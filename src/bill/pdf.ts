import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCents } from "@/lib/money";

export interface BillPdfInput {
  merchantName: string;
  billNumber: string;
  description: string | null;
  amountCents: number;
  currency: string;
  payUrl: string;
  issueDate?: string; // ISO YYYY-MM-DD; defaults to today
}

/**
 * Render a simple one-page bill PDF for a service business. Pure (no I/O beyond
 * pdf-lib); returns the PDF bytes for download or email attachment.
 */
export async function buildBillPdf(input: BillPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // US Letter
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.45, 0.45, 0.45);
  const issueDate = input.issueDate ?? new Date().toISOString().slice(0, 10);

  let y = 740;
  const left = 56;
  const text = (s: string, x: number, yy: number, size = 11, f = font, color = ink) =>
    page.drawText(s, { x, y: yy, size, font: f, color });

  text(input.merchantName, left, y, 20, bold);
  text("BILL", 612 - left - bold.widthOfTextAtSize("BILL", 20), y, 20, bold, muted);
  y -= 36;
  text(`Bill #: ${input.billNumber}`, left, y, 10, font, muted);
  text(`Date: ${issueDate}`, left, y - 14, 10, font, muted);

  y -= 64;
  text("Description", left, y, 11, bold);
  text("Amount", 612 - left - 100, y, 11, bold);
  y -= 6;
  page.drawLine({ start: { x: left, y }, end: { x: 612 - left, y }, thickness: 1, color: muted });

  y -= 24;
  text(input.description || "Service rendered", left, y, 11);
  text(formatCents(input.amountCents, input.currency), 612 - left - 100, y, 11, bold);

  y -= 40;
  page.drawLine({ start: { x: left, y }, end: { x: 612 - left, y }, thickness: 1, color: muted });
  y -= 22;
  text("Total due", 612 - left - 220, y, 13, bold);
  text(formatCents(input.amountCents, input.currency), 612 - left - 100, y, 13, bold);

  y -= 70;
  text("Pay this bill online:", left, y, 11, bold);
  y -= 18;
  text(input.payUrl, left, y, 10, font, rgb(0.16, 0.18, 0.9));
  y -= 28;
  text("Pay over time with Klarna, by card, or set up a subscription.", left, y, 10, font, muted);

  return doc.save();
}
