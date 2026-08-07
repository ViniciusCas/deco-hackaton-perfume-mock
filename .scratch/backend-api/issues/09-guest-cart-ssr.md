# Fix guest cart identity during SSR

Type: grilling
Status: resolved

## Question

Graduated from the map's fog. Guest cart identity is currently a
client-held opaque id (`sessionToken`, stored in `localStorage`, sent as
`X-Cart-Session`) — chosen in ticket 01's amendment specifically to avoid
**cross-site cookie fragility**, since a cookie set by `sillage-api` (a
different origin than the website) is a third-party cookie from the
browser's perspective and increasingly unreliable (Safari ITP, Chrome's
phase-out, etc.).

That reasoning is correct for a cookie `sillage-api` would set — but it
doesn't apply to a cookie **this website sets on its own origin**. A
first-party cookie (set by `deco-hackaton-perfume-mock` itself, not
`sillage-api`) has none of the third-party fragility: it's the exact same
mechanism Better Auth's session cookie already uses successfully, and
[ticket 06](06-ssr-token-forwarding.md) already built the pattern for
reading a same-origin cookie during SSR and forwarding its value to
`sillage-api` as a header (`sillageApiAuthHeader`/`fetchSillageApi` in
`src/db/sillage-api.ts`).

Proposed fix: store the guest cart-session id in a first-party cookie
(client-set, via `document.cookie`, whenever `sillageApiFetch` captures a
new `sessionToken` — same trigger as the current `localStorage` write) instead
of (or alongside) `localStorage`. SSR then reads that cookie directly off
the incoming request (same as it already does for the bearer token) and
forwards it as `X-Cart-Session` when prefetching cart data — restoring the
root route's cart prefetch that [ticket 07](07-frontend-cutover.md) removed.

Open questions:
1. Replace `localStorage` entirely, or keep both (cookie for SSR, localStorage as-is for client calls)?
2. Cookie attributes — name, `SameSite`, expiry, `Secure`?
3. Does the root route's cart prefetch come back exactly as it was before
   ticket 07 removed it, or does it need to change shape now that `useCart()`
   calls `sillage-api` directly rather than a local `createServerFn`?

## Answer

1. **Cookie only, `localStorage` dropped** for guest cart identity — one
   source of truth, readable by both client JS (`document.cookie`) and SSR
   (request headers), no drift risk between two copies.
2. **Cookie**: `sillage_cart_session`, `SameSite=Lax`, 1-year expiry, not
   `httpOnly` (client JS must set/read it directly — it's an id, not a
   secret). Matches the naming/TTL convention of the pre-cutover guest-cart
   cookie from the original auth-model decision.
3. **Root route's cart prefetch restored**, via `fetchSillageApi` (the same
   SSR-forwarding helper ticket 06 built for the bearer token), now also
   forwarding the cart-session cookie as `X-Cart-Session`. Removes the
   post-hydration empty-cart flash for both guests and signed-in users.

The bearer token (`localStorage`, `set-auth-token`) is unaffected by this —
that's a different mechanism for a different reason (an actual credential,
not just an id) and stays as ticket 07 left it.

## Implementation notes

**What shipped**: `src/platform/sillage-api-client.ts`'s cart-session
storage switched from `localStorage` to a first-party `document.cookie`
(`sillage_cart_session`, `SameSite=Lax`, 1yr). `src/db/sillage-api.ts`
renamed `sillageApiAuthHeader` → `sillageApiHeaders` and now also reads
that cookie off the incoming SSR request, forwarding it as `X-Cart-Session`
alongside the bearer token. `src/routes/__root.tsx`'s `beforeLoad` prefetches
cart data again, but **only when a session or cart-session cookie is
already present** — a first-time guest still gets the post-hydration flash,
by design (see the ticket text above).

**Real build-time correction**: the first implementation attempt called
`getRequest()` directly inside `beforeLoad` — this passed `tsc` and worked
under `vite dev`, but **failed the actual production build**
(`npm run build`)'s `tanstack-start-core:import-protection` plugin, which
correctly refuses server-only imports (`@tanstack/react-start/server`) in
`__root.tsx` because that file is also bundled client-side. `vite dev`
doesn't enforce this, so it went undetected until a real build was run.
Fixed by moving the logic into a proper `createServerFn`
(`getCartSsrServerFn` in `src/platform/cart/cart.actions.ts`), matching the
pattern every other SSR fetch in this codebase already uses
(`getUserServerFn`, `getCatalogServerFn`). Lesson: `tsc --noEmit` passing is
not sufficient verification for this class of TanStack Start bug —
`npm run build` must actually be run.

**False alarm, corrected**: mid-implementation, a `grep`-the-whole-page
test method produced what looked like a serious cross-visitor data leak
(one visitor's cart appearing on a different, cookie-less visitor's
request). Investigation traced it to test methodology, not a real bug — the
matched string ("Le Male...") is also a legitimate, always-present product
name in the homepage's public Best Sellers section, unrelated to cart
state. Scoped verification (checking only the `<aside aria-label="Cart">`
HTML) showed correct behavior throughout, both before and after this
change. **However**, while chasing this down, a real, separate, pre-existing
issue was found and fixed anyway: `src/router.tsx` created its `QueryClient`
at module scope rather than inside `getRouter()`. TanStack Start calls
`getRouter()` fresh per request server-side (confirmed empirically — logged
a random value inside it, saw two different values across two requests),
so a module-scoped `QueryClient` defeated that per-request isolation and
was a latent risk under genuinely concurrent (not sequential) requests —
even though no leak was ever actually proven. Fixed by moving `QueryClient`
creation inside `getRouter()`, matching TanStack Start's own recommended
pattern. Kept as a correctness improvement independent of the false alarm.

**Verification**: both repos typecheck clean, `npm run build` succeeds
(after the `createServerFn` fix), and the full guest-cart-SSR flow was
exercised locally end-to-end (local Docker Postgres + local `sillage-api`
`wrangler dev` + local `vite dev`, real cart created via `sillage-api`,
cookie forwarded, minicart correctly rendered server-side with the real
item; a cookie-less request correctly rendered the empty state; four
alternating requests confirmed no cross-request contamination). All local
test data cleaned up, both local dev servers stopped. **Not yet deployed.**
