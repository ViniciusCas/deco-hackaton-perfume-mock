Type: task
Status: resolved
Blocked by: 01, 02

## Answer

Added `src/routes/cart.tsx`, wired to the real `useCart`/`useUpdateCartItem`/
`useRemoveCartItem` hooks (same ones `Minicart.tsx` uses — no reimplementation).
Free-sample picker, gift-note checkbox, and promo-code field are local
component state only, commented in-code as UI-only mocks with no backing
data model or network call. Checkout uses a plain `<a href>` to
`cart.checkoutUrl` (external Shopify URL) rather than the router's `Link`,
matching the pre-existing pattern in `Minicart.tsx`. Also restyled
`Minicart.tsx` itself off daisyUI (it hadn't been touched by ticket 03) and
added a "View full bag" link from the drawer to `/cart`, resolving the
Bag→Cart-page question deferred from ticket 03. `MinicartDrawer.tsx`'s
`bg-base-100` swapped to `bg-surface`.

## Question

Add a new `/cart` route (`src/routes/cart.tsx`) matching
`templates/cart/Cart.dc.html`'s structure: line items with qty steppers wired
to the real `useCart` platform hook (same one `Minicart.tsx` uses — reuse its
mutations, don't reimplement), order summary (subtotal/shipping/tax/total),
promo code field, gift note. Concepts with no backing data model (free-sample
picker, gift note, promo code, tax estimate) are mocked as local component
state with no network call — labelled clearly in code as UI-only mocks, not
wired to checkout. Link to it from `Bag.tsx` / `MinicartDrawer.tsx` review
whether the minicart drawer should link to `/cart` ("View bag" style CTA) —
decide and note it in the answer.
