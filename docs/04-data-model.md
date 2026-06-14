# 04 · Data model

The data model centers on an **append-only ledger**. Money movements are
recorded as immutable events; balances are **derived** from those events (and
optionally cached in a maintained running total that is reconciled against the
event log). All money is stored in **integer minor units (cents)**.

## Entities at a glance

| Entity | Purpose |
|--------|---------|
| `Merchant` | The shop / supplier / brand using Noctua Pay. Owns a Stripe Connect account. |
| `Payer` | A consumer or business buyer (Models A/B). May be lightweight. |
| `Partner` | A financing partner (BNPL via Stripe, Resolve, embedded-capital). |
| `PaymentLink` | A request/invoice a payer opens (Models A/B). |
| `Transaction` | A single funded payment (Models A/B): partner funds merchant. |
| `Deal` | A Model C financing agreement (advance, factor, sweep rate, maturity). |
| `Sale` | A sale that runs through the platform for a Model C deal. |
| `LedgerEvent` | Immutable record of every money movement (the system of record). |
| `Notification` | Outbound link/receipt/reminder record. |
| `WebhookEvent` | Raw, verified inbound partner/Stripe event for idempotent intake. |

## Relationships

```
Merchant 1──* PaymentLink 1──* Transaction *──1 Partner
Merchant 1──* Deal *──1 Partner
Deal     1──* Sale
(Transaction | Deal | Sale | Deal-balloon) 1──* LedgerEvent
Merchant 1──* Notification
Partner/Stripe ──* WebhookEvent (raw intake) ──> LedgerEvent (derived)
```

## Prisma schema sketch (Postgres)

> Illustrative; not a committed migration. `Decimal`/`BigInt` for money;
> enums for model/state. Tune precision and indexes before implementing.

```prisma
// datasource & generator omitted for brevity

enum MoneyModel {
  CONSUMER   // A
  B2B_TERMS  // B
  MAKE_SELL  // C
}

enum PartnerKind {
  BNPL_STRIPE      // Klarna / Affirm via Stripe (A)
  RESOLVE          // B2B net terms (B)
  EMBEDDED_CAPITAL // Kickfurther / Wayflyer / Parafin (C)
}

enum LinkStatus     { DRAFT OPEN FUNDED EXPIRED CANCELLED }
enum DealStatus     { DRAFT FUNDED ACTIVE CLEARED MATURED DEFAULTED }
enum LedgerKind     { ADVANCE FUNDING SALE SWEEP BALLOON REBATE FEE ADJUSTMENT }

model Merchant {
  id                String        @id @default(cuid())
  name              String
  email             String        @unique
  stripeAccountId   String?       @unique  // Stripe Connect account
  createdAt         DateTime      @default(now())
  paymentLinks      PaymentLink[]
  deals             Deal[]
  notifications     Notification[]
}

model Partner {
  id            String        @id @default(cuid())
  kind          PartnerKind
  displayName   String
  transactions  Transaction[]
  deals         Deal[]
}

model Payer {
  id            String        @id @default(cuid())
  kind          String        // "consumer" | "business"
  displayName   String?
  email         String?
  transactions  Transaction[]
}

// --- Models A & B ---------------------------------------------------------

model PaymentLink {
  id            String        @id @default(cuid())
  merchantId    String
  merchant      Merchant      @relation(fields: [merchantId], references: [id])
  model         MoneyModel    // CONSUMER or B2B_TERMS
  amountCents   BigInt
  currency      String        @default("usd")
  description   String?
  status        LinkStatus    @default(OPEN)
  token         String        @unique        // public, unguessable URL token
  expiresAt     DateTime?
  createdAt     DateTime      @default(now())
  transaction   Transaction?
}

model Transaction {
  id              String       @id @default(cuid())
  paymentLinkId   String       @unique
  paymentLink     PaymentLink  @relation(fields: [paymentLinkId], references: [id])
  partnerId       String
  partner         Partner      @relation(fields: [partnerId], references: [id])
  payerId         String?
  payer           Payer?       @relation(fields: [payerId], references: [id])
  amountCents     BigInt       // funded to merchant in full
  feeCents        BigInt       @default(0) // Noctua Pay's share of partner fee
  fundedAt        DateTime?
  ledgerEvents    LedgerEvent[]
}

// --- Model C --------------------------------------------------------------

model Deal {
  id              String       @id @default(cuid())
  merchantId      String
  merchant        Merchant     @relation(fields: [merchantId], references: [id])
  partnerId       String
  partner         Partner      @relation(fields: [partnerId], references: [id])
  advanceCents    BigInt                      // day-0 cash to maker/3PL
  factor          Decimal      @db.Decimal(5, 4)   // e.g. 1.1500
  sweepRateBps    Int                         // basis points, e.g. 4000 = 40%
  maturityDate    DateTime
  earlyPayoffRebateBps Int?                   // optional fairness lever
  status          DealStatus   @default(DRAFT)
  // derived/cached running totals (reconciled against ledger events)
  sweptToDateCents BigInt      @default(0)
  createdAt       DateTime     @default(now())
  sales           Sale[]
  ledgerEvents    LedgerEvent[]

  // capCents = round(advanceCents * factor)  — computed, not stored, or stored + reconciled
}

model Sale {
  id            String       @id @default(cuid())
  dealId        String
  deal          Deal         @relation(fields: [dealId], references: [id])
  grossCents    BigInt
  sweepCents    BigInt       // clamped so cumulative sweeps never exceed cap
  stripeChargeId String      @unique
  occurredAt    DateTime     @default(now())
  ledgerEvents  LedgerEvent[]
}

// --- The system of record -------------------------------------------------

model LedgerEvent {
  id            String       @id @default(cuid())
  kind          LedgerKind
  amountCents   BigInt       // signed: positive = to financer/merchant per kind
  currency      String       @default("usd")
  // exactly one of these is set, depending on kind
  transactionId String?
  transaction   Transaction? @relation(fields: [transactionId], references: [id])
  dealId        String?
  deal          Deal?        @relation(fields: [dealId], references: [id])
  saleId        String?
  sale          Sale?        @relation(fields: [saleId], references: [id])
  // idempotency: ties an event to the external source that caused it
  sourceEventId String?      @unique
  createdAt     DateTime     @default(now())

  @@index([dealId, kind])
  @@index([transactionId])
}

model WebhookEvent {
  id            String       @id @default(cuid())
  source        String       // "stripe" | "resolve" | "embedded_capital"
  externalId    String                       // provider's event id
  payload       Json
  verifiedAt    DateTime?
  processedAt   DateTime?
  createdAt     DateTime     @default(now())

  @@unique([source, externalId])             // idempotent intake
}

model Notification {
  id            String       @id @default(cuid())
  merchantId    String?
  merchant      Merchant?    @relation(fields: [merchantId], references: [id])
  channel       String       // "email" | "sms"
  kind          String       // "link" | "receipt" | "schedule" | "reminder"
  to            String
  sentAt        DateTime?
  createdAt     DateTime     @default(now())
}
```

## Invariants the schema must protect

- **Append-only ledger.** `LedgerEvent` rows are never updated or deleted;
  corrections are new `ADJUSTMENT` events.
- **No double-counting.** `LedgerEvent.sourceEventId` and
  `WebhookEvent(source, externalId)` are unique → retried webhooks are safe.
- **Sweeps never exceed the cap.** Enforced in application logic (clamp) and
  checkable by the reconciliation job: `Σ SWEEP ≤ cap` for every deal.
- **Derived balances reconcile.** `Deal.sweptToDateCents` must equal
  `Σ Sale.sweepCents` for the deal; a periodic job asserts this.
- **Money is integer cents.** `BigInt` for amounts; `Decimal` only for
  rates/factors.

## Open modeling questions (decide before implementing)

- Whether to store `capCents` or always compute it (recommended: compute, or
  store + reconcile).
- Multi-currency: scope to USD for v1 per the single-niche guardrail.
- Payer identity depth for Models A/B (partner usually owns the payer record).
- Personal-guarantee / UCC-lien metadata for Model C deals (legal artifacts may
  live outside the app DB).
