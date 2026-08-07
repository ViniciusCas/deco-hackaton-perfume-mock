# Cut the frontend over to sillage-api

Type: grilling
Status: resolved

## Question

Graduated from the map's fog now that [SSR token forwarding](06-ssr-token-forwarding.md)
is resolved. This is the map's actual Destination: point
`src/platform/{cart,wishlist,address}` and a new orders/checkout flow at
`sillage-api` instead of the Shopify/`invoke.site.*` plumbing, per
[the endpoint design](02-endpoint-surface-design.md) and [contract
conventions](03-contract-conventions.md), keeping the existing hook surface
(`useCart`, `useToggleWishlist`, `useAddresses`, etc.) working from the
component side where reasonably possible.

Remaining open questions before writing code:

1. **`sillage-api`'s base URL, from the website's side.** Not deployed yet —
   what does the website point at for local dev vs. production?
2. **Client-side bearer-token storage.** The bearer token only reaches the
   browser via the `set-auth-token` response header on sign-in/sign-up
   (`user.actions.ts` doesn't currently forward it to the client at all —
   that's part of this ticket's work). Where does the client hold it between
   page loads?
3. **Module structure**: one shared `sillage-api` fetch client used by all
   four hook files, or each platform module keeps its own fetch logic?
4. **Error mapping**: `sillage-api` returns `{ error: { code, message, details? } }`;
   existing hooks/components (e.g. `login.tsx`) currently read `err.message`
   off a plain `Error`. Keep that pattern (throw `Error(message)`) or expose
   `code` too for components that want to branch on it?

## Answer

1. **Base URL**: `SILLAGE_API_URL` as a `wrangler.jsonc` var (this repo),
   `http://localhost:8787` in `.dev.vars` for local dev against
   `sillage-api`'s own `wrangler dev`. No production value yet — `sillage-api`
   isn't deployed (fog item, still open).
2. **Token storage**: `localStorage`, same reasoning/consistency as the
   guest cart-session id.
3. **Module structure**: one shared client,
   `src/platform/sillage-api-client.ts` — base URL resolution, token
   attach/read (from `localStorage` client-side), envelope unwrapping,
   typed error. Cart/wishlist/address/orders hooks all go through it.
4. **Error shape**: a `SillageApiError extends Error` carrying `.code`
   (and `.details`) alongside `.message`.

Implementation proceeds directly from here — the endpoint contract
([ticket 02](02-endpoint-surface-design.md)/[ticket 03](03-contract-conventions.md))
and the SSR-forwarding mechanism ([ticket 06](06-ssr-token-forwarding.md))
are both already fully specified, so this is now a straightforward build
against settled decisions, not a further design question.

**Base URL note actually implemented differently than point 1 above**: rather
than a `cloudflare:workers` `wrangler.jsonc` var (server-only), the base URL
is `import.meta.env.VITE_SILLAGE_API_URL` — Vite exposes `VITE_`-prefixed
vars from `.dev.vars` (sourced into `process.env` by the `dev` script) to
*both* client and SSR bundles uniformly, avoiding a second, divergent
mechanism just for server-side code. Same env var name, same value, just one
resolution path instead of two.

**What shipped**:
- `src/platform/sillage-api-client.ts` (new) — the shared client-side fetch
  wrapper: `sillageApiFetch<T>()` (base URL, `Authorization`/`X-Cart-Session`
  header attach, `{ data }`/`{ error }` envelope unwrapping into
  `SillageApiError`), `getStoredAuthToken`/`setStoredAuthToken`,
  `getStoredCartSession`/`setStoredCartSession` (both `localStorage`,
  SSR-safe via `typeof window` guards). A cart response's `sessionToken` is
  captured into storage automatically on every call.
- `src/db/sillage-api.ts` — simplified to read the base URL from
  `import.meta.env.VITE_SILLAGE_API_URL` internally rather than taking it as
  a parameter (matches the client module's resolution).
- `src/platform/user/user.actions.ts`/`user.hooks.ts` — `signInServerFn`/
  `signUpServerFn` now return `{ user, authToken }` (new `AuthResult` type)
  instead of bare `Person | null`, reading `set-auth-token` off Better
  Auth's response headers; `useSignIn`/`useSignUp` write `authToken` to
  `localStorage`, `useSignOut` clears it.
- `src/platform/cart/*` — `cart.actions.ts` and `cart.shopify.ts` deleted
  entirely (no more Shopify calls or intermediate `createServerFn`
  wrapping); `cart.types.ts` renamed fields to match the schema
  (`itemId`/`variantId`/`slug`, `image` is now a plain URL string, dropped
  `compareAtPrice`/`checkoutUrl`); `cart.hooks.ts` calls `sillageApiFetch`
  directly. `cart.tsx`, `Minicart.tsx`, `ProductActions.tsx` updated to the
  new field names; both "Checkout" buttons now always render disabled
  (no `checkoutUrl` to conditionally show a link for).
- `src/platform/wishlist/*` — `wishlist.types.ts`'s `productIDs` → `productIds`
  (matches `sillage-api`'s JSON key); `useToggleWishlist` now takes an
  explicit `inWishlist` flag from the caller instead of re-deriving it from
  the query cache inside `mutationFn` (that would have raced `onMutate`'s
  optimistic write — TanStack Query runs `onMutate` before `mutationFn`).
  `productGroupID` dropped from `WishlistButton.tsx` per ticket 02.
  `src/loaders/_cookie.ts` and `src/actions/wishlist/submit.ts` (dead code,
  still registered in `setup.ts` for Deco's block system but no longer
  called by any hook) fixed to the renamed field so the build stays green —
  not deleted, since removing them risks the Deco block-generation pipeline
  without being able to verify that build step here.
- `src/platform/address/*` — `address.hooks.ts` now calls `sillage-api`
  directly (`GET/POST /v1/addresses`, `PATCH/DELETE /v1/addresses/:id`,
  `POST /v1/addresses/:id/default`); `AddressInput` moved from the legacy
  `src/actions/address/submit.ts` into `address.hooks.ts` itself, decoupling
  from that now-dead file (also still registered in `setup.ts`, same
  reasoning as wishlist's — left in place, unreferenced).
- `src/platform/orders/` (new) — `Order`/`CheckoutInput` types and a single
  `useCheckout()` mutation hook (`POST /v1/orders`, invalidates the cart
  query on success). **No consuming UI** — both "Checkout" buttons stay
  disabled; the actual checkout form/flow is still fog, not built.
- `src/routes/__root.tsx` — removed the `beforeLoad` cart prefetch entirely.
  Wiring it through `fetchSillageApi` (ticket 06) only solves the
  *authenticated* SSR case; a first-time guest has no cart-session id for
  SSR to send at all (that id is only minted by the client's first write),
  so prefetching unconditionally would have silently created an orphaned
  cart row per guest page load. `useCart()` now fetches client-side only,
  after hydration.

**Verification**: both repos typecheck clean (`tsc --noEmit`). Not run
against a live `sillage-api` — it isn't deployed, so no end-to-end request
has actually been made through this new code path yet.

**Explicitly not done**:
- No checkout UI — `useCheckout()` exists but nothing calls it.
- Guest cart identity during SSR is still unresolved (root cause of the
  prefetch removal above) — first-time guests see an empty cart via
  `placeholderData` until the client-side fetch resolves post-hydration.
- `sillage-api` is still not deployed or pushed to GitHub — this cutover
  code cannot be exercised against a live backend yet.
- Dead legacy files (`src/actions/{wishlist,address}/submit.ts`,
  `src/loaders/wishlist.ts`, `src/loaders/_cookie.ts`'s wishlist/address
  helpers, their `setup.ts` registrations) were fixed to keep typechecking
  but not removed — cleanup deferred, not attempted blind.
