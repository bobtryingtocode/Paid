# 14 · Bills — PDF generation & email delivery

Service businesses create a bill for a completed job, and Cadence generates a
**PDF** and **emails it** to the customer with a link to the hosted payment page
([`13`](13-buyer-facing-payments.md)).

## Flow

```
/bills (merchant) ──create──▶ PaymentLink ──▶ buildBillPdf ──▶ sendBillEmail ──▶ customer inbox
                                   │                                                   │
                                   └────────── pay link: /pay/[token] ◀────────────────┘
```

## Pieces

| Path | Responsibility |
|------|----------------|
| `src/bill/pdf.ts` | `buildBillPdf(...)` → a one-page bill PDF (pdf-lib, no native deps): seller, bill #, description, total, and the pay URL |
| `src/notify/mailer.ts` | `sendBillEmail(...)` → Resend HTTP API with the PDF attached when `RESEND_API_KEY` is set; otherwise a **stub** that logs (dev works with no provider) |
| `POST /api/links/:id/send` | Generate the PDF + email it to `{ customerEmail }` (auth + ownership) |
| `GET /api/links/:id/bill` | Download/preview the bill PDF (auth + ownership) |
| `/bills` | Merchant UI: create a bill (amount + description + customer email), email it, and list recent bills with pay-link + PDF links |

## Configuration

| Env | Purpose |
|-----|---------|
| `RESEND_API_KEY` | Email provider key. Unset → stub mode (logs, no send). |
| `EMAIL_FROM` | Verified sender/domain for outgoing bill emails. |

Swapping Resend for SES/Postmark/etc. is a change inside `sendBillEmail` only —
callers are unchanged.

## Status & guardrails

- The PDF is intentionally simple (single line item from the `PaymentLink`).
  Richer invoices (multiple line items, tax) would extend the bill model.
- Email is best-effort: the API reports `{ delivered, provider }` so the UI can
  tell the merchant when it's in stub mode.
- Bill PDFs are generated on demand (not stored); if you later want to retain
  them, add object storage (e.g. Supabase Storage) and a reference on the link.
