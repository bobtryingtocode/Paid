# 11 · Auth & billing UI

Real authentication (Auth.js / NextAuth v5) plus the customer-facing pricing &
usage page. This replaces the `TODO(auth)` stubs: protected routes now resolve
the merchant from the session instead of a passed `merchantId`.

## Authentication (Auth.js / NextAuth v5)

- **Config:** `src/auth.ts` — JWT session strategy (no adapter tables), a
  **Credentials** provider that authenticates a `Merchant` by email + password.
  The merchant id is carried in the JWT and surfaced as
  `session.user.merchantId`.
- **Passwords:** `src/auth/password.ts` — scrypt hash/verify (`salt:derivedKey`,
  no native dependency). `Merchant.passwordHash` added to the schema.
- **Routes:**
  - `GET/POST /api/auth/[...nextauth]` — NextAuth handlers (sign-in, callbacks).
  - `POST /api/auth/signup` — create a merchant with a hashed password.
- **Helper:** `currentMerchantId()` (in `src/auth.ts`) returns the signed-in
  merchant id server-side, or null.
- **Env:** `AUTH_SECRET` (session signing secret).

### Protected routes now use the session

`/api/links` (POST + GET), `/api/agent/p2p`, `/api/billing/checkout`, and
`/api/billing/subscription` no longer accept a `merchantId` from the client —
they call `currentMerchantId()` and return **401** when unauthenticated. The
public payer endpoints (`/api/pay/*`) and webhooks remain unauthenticated by
design.

## UI

- **`/login`** — combined sign-in / sign-up form (client). Signup calls
  `/api/auth/signup` then signs in via NextAuth credentials; redirects to
  `/billing`.
- **`/billing`** — server component (auth-gated; redirects to `/login` if signed
  out). Shows the current plan + a **usage bar** (used / allowance / remaining,
  turns red at 100%) and the plan cards. Subscribing posts to
  `/api/billing/checkout` and redirects to Stripe Checkout
  (`src/app/billing/SubscribeButtons.tsx`).

## Status & guardrails

- JWT credentials auth is a solid baseline; for production consider email
  verification, password reset, rate-limiting on signin, and OAuth providers
  (all supported by Auth.js).
- The billing page reads usage server-side via `getSubscriptionSummary`; the
  subscribe action and usage reflect the per-token metering from
  [`10`](10-metering-and-billing.md).
