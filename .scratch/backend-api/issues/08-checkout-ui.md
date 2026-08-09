# Build the checkout UI

Type: task
Status: resolved

## Question

Graduated from the map's fog: `useCheckout()` ([ticket 07](07-frontend-cutover.md))
was fully wired to `POST /v1/orders` but had no consuming UI — both
"Checkout" buttons (cart page, minicart) rendered permanently disabled.
Build the actual checkout flow.

Real UX decisions needed before building, resolved via a short round:

1. **Location**: new `/checkout` route (not inline on `/cart`).
2. **Address input**: pick from saved addresses (`useAddresses()`, default
   pre-selected) or enter a new one ad-hoc for this order only (not saved to
   the address book) — matches `POST /v1/orders`' `{ addressId } | { shipping fields }`
   contract.
3. **Guest checkout**: **not** offered in the UI, despite the schema/API
   supporting it (`guestEmail`, nullable `customerId`) — `/checkout` requires
   sign-in, redirecting to a "sign in to check out" prompt otherwise. A
   deliberate product choice overriding the recommended option; the backend
   capability isn't removed, just not exposed here.
4. **Confirmation**: inline success state on `/checkout` itself, built from
   `POST /v1/orders`' own response (which already returns the full created
   order) — no `GET /orders/:id` exists (deliberately deferred, [ticket 02](02-endpoint-surface-design.md)),
   so this avoids needing it.

## Answer

**Shipped**: `src/routes/checkout.tsx` (new).

- Gated on `useUser().isAuthenticated` — mirrors `account.tsx`'s existing
  "you're not signed in" pattern rather than a hard redirect, for
  consistency with how this repo already handles auth-gated routes.
- Address selection: radio list built from `useAddresses()` (default
  pre-selected via `.find(a => a.isDefault)`), plus a "Use a different
  address" option revealing an inline ad-hoc form (recipient, street,
  city, region, postal, country). Submits either `{ addressId }` or the raw
  ad-hoc fields to `useCheckout()`, matching `CheckoutInput`'s existing union
  type exactly — no new type needed.
- Order summary sidebar reuses `useCart()`'s live cart data.
- On `checkout.isSuccess`, renders `OrderConfirmation` using
  `checkout.data` (the mutation's own response) — item list, total, order
  id, a "Continue shopping" link back to `/`. No route/fetch-by-id involved.
- Empty-cart guard: if `cart.items.length === 0` (and no order was just
  placed), shows the same "Your bag is empty" state as `/cart`.
- Both previously-disabled "Checkout" buttons (`src/routes/cart.tsx`,
  `src/components/minicart/Minicart.tsx`) now link to `/checkout` via
  `Button`'s existing `href` prop (renders a router `<Link>`).

**Verification**: `npx tsr generate` (new route needs the generated route
tree updated), `tsc --noEmit` clean, `npm run build` succeeds — a
`checkout-*.js` chunk is produced. **Not deployed and not exercised against
the live `sillage-api`** — no browser available in this session to click
through the actual flow (see the cart/wishlist/address verification notes
on the map's Decisions so far for how those were instead verified via
direct `sillageApiFetch`-equivalent curl calls; the same approach could
verify `POST /v1/orders` here too, but wasn't run as part of this ticket).

**Explicitly not done**:
- Not deployed — this is uncommitted, unverified-live code as of this
  ticket's resolution.
- Selecting "Use a different address" doesn't offer to save the new address
  to the account's address book — it's genuinely one-time/ad-hoc, matching
  the API contract as designed, but worth knowing if a future request
  assumes otherwise.
- No guest checkout entry point, per the explicit product decision above —
  the backend still supports it if a future ticket wants to add it back.