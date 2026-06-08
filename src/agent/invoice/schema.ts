import { z } from "zod";

/**
 * Canonical invoice schema — the normalized form every downstream step
 * (recommendation, scheduling, journal entries) depends on. Extraction maps a
 * raw PDF/text invoice into this shape. All money is integer minor units
 * (cents). Dates are ISO `YYYY-MM-DD`.
 *
 * (ADF / "Allotrope" is a scientific-instrument data standard and does not fit
 * financial documents, so we normalize to this purpose-built schema instead.)
 */
export const LineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().nonnegative(),
  unitPriceCents: z.number().int(),
  amountCents: z.number().int(),
});

export const VendorSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
  address: z.string().optional(),
});

export const CanonicalInvoiceSchema = z.object({
  vendor: VendorSchema,
  invoiceNumber: z.string(),
  issueDate: z.string(), // ISO YYYY-MM-DD
  dueDate: z.string().optional(),
  currency: z.string().length(3).default("usd"),
  lineItems: z.array(LineItemSchema),
  subtotalCents: z.number().int().nonnegative(),
  taxCents: z.number().int().nonnegative().default(0),
  totalCents: z.number().int().nonnegative(),
  paymentTerms: z.string().optional(), // e.g. "Net 30"
  poNumber: z.string().optional(),
  notes: z.string().optional(),
});

export type LineItem = z.infer<typeof LineItemSchema>;
export type Vendor = z.infer<typeof VendorSchema>;
export type CanonicalInvoice = z.infer<typeof CanonicalInvoiceSchema>;

/**
 * JSON schema for the `emit_invoice` extraction tool, mirroring the zod schema
 * above. Kept hand-written (no zod-to-json-schema dependency); the zod schema
 * is the runtime validator, this is what Claude fills in.
 */
export const EMIT_INVOICE_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    vendor: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        address: { type: "string" },
      },
      required: ["name"],
    },
    invoiceNumber: { type: "string" },
    issueDate: { type: "string", description: "ISO date YYYY-MM-DD" },
    dueDate: { type: "string", description: "ISO date YYYY-MM-DD" },
    currency: { type: "string", description: "ISO 4217 code, lowercase" },
    lineItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          unitPriceCents: { type: "integer" },
          amountCents: { type: "integer" },
        },
        required: ["description", "quantity", "unitPriceCents", "amountCents"],
      },
    },
    subtotalCents: { type: "integer" },
    taxCents: { type: "integer" },
    totalCents: { type: "integer" },
    paymentTerms: { type: "string" },
    poNumber: { type: "string" },
    notes: { type: "string" },
  },
  required: [
    "vendor",
    "invoiceNumber",
    "issueDate",
    "currency",
    "lineItems",
    "subtotalCents",
    "totalCents",
  ],
};
