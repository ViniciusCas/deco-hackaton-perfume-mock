# A real HTTP backend API for the storefront

## Destination

The Sillage storefront's still-unbuilt commerce surface — cart, wishlist,
address, orders — is exposed as real HTTP routes callable over plain `fetch`,
served by a **new, separate repository** (`sillage-api`, Hono on Cloudflare
Workers) rather than living inside this app. The website itself is the
(first) consumer — its frontend hooks call these HTTP endpoints, authenticated
via a bearer token instead of a shared cookie now that the two are different
origins — with the explicit benefit that the same surface is reusable by
other clients later without further backend work. Catalog and account/auth
stay in this repo on `createServerFn`, unmigrated. Data layer (Postgres via
Drizzle, Better Auth for sessions) is reused as-is, not redesigned — just
accessed from a second Worker via its own Hyperdrive binding and its own
(duplicated) schema copy.

## Notes

- Domain: `deco-hackaton-perfume-mock` (TanStack Start + React 19, Cloudflare
  Workers). Sibling maps: [Postgres backend for the storefront](../postgres-backend/map.md)
  (schema, Hyperdrive, Drizzle, Better Auth — all reused here, not redone),
  [Rebrand to Sillage](../remove-deco-identity/map.md).
- **Overlaps with an open ticket on the Postgres-backend map**:
  [Cut over cart/account/wishlist off the Shopify plumbing](../postgres-backend/issues/07-cutover-commerce.md)
  (unblocked, unclaimed as of charting) already covers replacing
  `cart.actions.ts`/`user.actions.ts`/wishlist/address's Shopify-shaped
  `createServerFn`s with Postgres-backed equivalents — just via RPC, not HTTP
  routes. The first ticket here ([Decide how this API relates to the existing
  createServerFn actions and ticket 07](issues/01-relationship-to-server-fn.md))
  settles whether this map supersedes ticket 07, narrows it, or the two proceed
  independently.
- **Transport, historical**: charting originally found that
  `@tanstack/react-start@1.166.8` supports file-based HTTP routes in *this*
  repo via a `server: { handlers: { GET, POST, ... } }` field on
  `createFileRoute`, distinct from `createServerFn`. That's no longer the
  plan — [ticket 01's amendment](issues/01-relationship-to-server-fn.md)
  moved the API to a separate repository (`sillage-api`, Hono on Cloudflare
  Workers) — but the finding is kept here for the record since it's what
  made "a real HTTP API" concretely buildable at all when this map was
  first scoped.
- **Auth is a bearer token, not a shared cookie** (decided in ticket 01's
  amendment, once the API repo split made "same-origin cookie" false):
  Better Auth's bearer plugin issues a token on sign-in/sign-up in this repo;
  `sillage-api` validates it via a direct `session`-table lookup, not by
  running Better Auth itself. Guest cart identity uses the same
  token-in-a-header pattern instead of a cookie.
- Catalog reads and accounts/auth are already live in production via
  `createServerFn` in this repo and **stay here** — they do not move to
  `sillage-api` in this pass (ticket 01's amendment).
- Tracker: local-markdown (`.scratch/`), same fallback as the sibling maps —
  GitHub Issues are disabled on this repo (see `docs/agents/issue-tracker.md`
  vs. actual practice in `.scratch/`).

## Decisions so far

- [Decide how this API relates to the existing createServerFn actions and ticket 07](issues/01-relationship-to-server-fn.md) —
  `createServerFn` is being replaced for **cart, wishlist, address, orders**
  only (none have a working backend today: cart is an unconfigured Shopify
  stub, wishlist/address run on a legacy `invoke.site.*` cookie-backed
  runtime, orders doesn't exist). Catalog and account/auth stay on
  `createServerFn` in this repo, unmigrated. [Ticket 07 on the
  Postgres-backend map](../postgres-backend/issues/07-cutover-commerce.md) is
  superseded and closed. **Amended**: the new surface is built in a separate
  repository, `sillage-api` (Hono on Cloudflare Workers, its own Hyperdrive
  binding to the same RDS instance, its own duplicated copy of the Drizzle
  schema) — not as routes inside this repo. Cross-origin auth is a **bearer
  token** (Better Auth's bearer plugin here, validated by `sillage-api`
  querying the `session` table directly) and guest cart identity is a
  client-held opaque id sent as a header, not a cookie — both chosen to avoid
  cross-site-cookie fragility now that the two are genuinely different
  origins. CORS moved from deferred fog into immediate, real scope as a
  result.
- [Decide auth/session handling for /api/\* requests](issues/04-auth-cookie-handling.md) —
  closed as superseded by the above: its cookie/CSRF questions are moot once
  auth is a bearer token, not a cookie. Surfaced one unresolved question,
  logged below in fog rather than re-opening the ticket.
- [Design the endpoint surface: routes, methods, and payload shapes per domain](issues/02-endpoint-surface-design.md) —
  nested RESTful routes (`/cart`, `/cart/items/:itemId`, `/wishlist/:productId`,
  `/addresses/:id`, `/addresses/:id/default`, `/orders`), fields renamed off
  Shopify's vocabulary to match the schema (`variantId`/`itemId`), wishlist
  split into explicit `POST`/`DELETE` rather than a toggle, `productGroupID`
  dropped (vestigial). Cart identity: bearer token or an `X-Cart-Session`
  header, server-issued on first request. Wishlist reads are ungated (empty
  for guests), its writes and all of addresses require a bearer token.
  Orders is checkout-only (`POST /orders`) — validates and decrements stock,
  accepts a saved `addressId` or ad-hoc shipping fields, requires
  `guestEmail` for guest checkout, clears the cart on success. No order
  list/history endpoint in this pass.
- [Decide the shared HTTP contract conventions](issues/03-contract-conventions.md) —
  `/v1` prefix on every route, success responses wrapped as `{ data }`,
  errors as `{ error: { code, message, details? } }`, standard REST status
  codes (200/201/400/401/404). Pagination explicitly left unspecified — none
  of the four domains need it yet.
- [Scaffold the sillage-api repository](issues/05-scaffold-sillage-api.md) —
  `sillage-api` created at `~/dev/hackaton-deco/sillage-api` (Hono, committed
  as `c25a2b5`), reusing the website's existing Hyperdrive config via a
  second binding. `/v1/cart`, `/v1/wishlist`, `/v1/addresses`, `/v1/orders`
  implemented (not left as stubs) against tickets 02/03's exact contract,
  plus bearer-token middleware and CORS. Website repo's `src/db/auth.ts` now
  enables Better Auth's bearer plugin.
- [Decide how SSR forwards a token to sillage-api, and fix bearer-token validation](issues/06-ssr-token-forwarding.md) —
  SSR forwards the browser's own already-signed session cookie (via Better
  Auth's `getSessionCookie` helper) verbatim as the bearer token — no new
  minting mechanism. Fixed a real bug in `sillage-api`'s already-shipped
  validation: incoming tokens are `<rawToken>.<signature>`, not the bare
  `session.token` value; the DB lookup now strips the signature first, no
  HMAC verification (the DB exact-match is the real access boundary).
- [Cut the frontend over to sillage-api](issues/07-frontend-cutover.md) —
  `src/platform/{cart,wishlist,address}` now call `sillage-api` directly
  (`sillageApiFetch`, new shared client) instead of Shopify/`invoke.site.*`;
  a new `src/platform/orders` module adds checkout (`useCheckout`). Bearer
  token captured from Better Auth's `set-auth-token` header into
  `localStorage` on sign-in/sign-up. Root route's SSR cart prefetch removed
  entirely — see fog below.
- **Both repos deployed and verified live** (not part of any single ticket —
  deploy + smoke test, done directly): `sillage-api` at
  `https://sillage-api.sillage-hackaton.workers.dev` (Version `845679dc`),
  website redeployed at `https://sillage.sillage-hackaton.workers.dev`
  (Version `74f985af`) with the cutover code. No browser was available in
  this session, so verification was direct HTTP calls reproducing exactly
  what the hooks send: cart (add → get → update quantity → remove, subtotal
  recalculates correctly), wishlist (add → get → remove), and address
  (create two, set-default correctly flips the single-default invariant,
  delete both) — all confirmed against production RDS via a throwaway test
  user, cleaned up afterward. CORS confirmed working for the live website's
  exact origin.
- [Build the checkout UI](issues/08-checkout-ui.md) — new `/checkout` route:
  sign-in required (a deliberate product choice — guest checkout stays
  unexposed in the UI even though the API supports it), pick a saved address
  or enter one ad-hoc, inline confirmation built from `POST /v1/orders`'s
  own response (no `GET /orders/:id` needed). Both "Checkout" buttons now
  link to it. Deployed (Version `4e5a2eda`) and fully verified live via
  direct HTTP calls reproducing the exact checkout flow: order placed with
  ad-hoc shipping fields, cart correctly cleared, `product_variants.stock`
  correctly decremented in production RDS (60 → 58), order + order-line
  snapshot correctly persisted, insufficient-stock correctly rejected with
  the exact error shape the UI expects. All test data cleaned up.
- **`sillage-api` pushed to GitHub**: `https://github.com/ViniciusCas/sillage-api`
  (private, branch `master`). Not part of any ticket — done directly on request.
- [Fix guest cart identity during SSR](issues/09-guest-cart-ssr.md) — guest
  cart identity moved from `localStorage` to a first-party cookie
  (`sillage_cart_session`, this website's own origin, not `sillage-api`'s —
  no third-party-cookie fragility). SSR reads it the same way it already
  reads the bearer-token cookie (ticket 06) and the root route's cart
  prefetch is restored, but only when a session/cart-session cookie already
  exists — a first-time guest still gets the post-hydration flash by design.
  Along the way: found and fixed a real production-build failure (calling
  `getRequest()` directly in `beforeLoad` passes `tsc` and `vite dev` but
  fails `npm run build`'s import-protection check — fixed via a proper
  `createServerFn`, `getCartSsrServerFn`), and fixed a real, separate,
  pre-existing bug in `src/router.tsx` (`QueryClient` created at module
  scope instead of inside `getRouter()`, defeating TanStack Start's
  per-request isolation on the server) found while investigating what
  turned out to be a false-alarm data-leak report — see the ticket for the
  full corrected account. Verified end-to-end locally (Docker Postgres +
  both dev servers), then committed (`47c9db7`) and deployed (Version
  `bf167b06`). All key routes smoke-tested 200 on production.
- **Fixed: "Add to bag" did nothing on the real product page.** Found by
  the user actually clicking through the live site — the first real-browser
  test of this whole effort, and it immediately caught what curl-based
  verification structurally couldn't. Root cause: `src/routes/$.tsx` (the
  actual `/{slug}` catch-all serving real catalog products) had a
  **hardcoded, permanently-`disabled` "Add to bag — demo" button**, wired to
  nothing — leftover from the sillage-redesign pass, which explicitly scoped
  cart wiring out. The component that *was* correctly wired to
  `useAddToCart` (`ProductActions.tsx`) is only used by a Deco CMS section
  (`sections/Product/ProductDetails.tsx`), not the real product route.
  Separately, `CatalogEntry` (the type `$.tsx` receives) never exposed a
  variant id at all — list views never needed it before checkout existed —
  so there was no way to wire a real "Add to bag" button even if someone
  had tried. Fixed: new `getProductVariantsBySlugServerFn`
  (`src/db/queries.ts`'s `getProductVariantsBySlug`, `src/platform/catalog/`)
  fetches real `productVariants` rows (id/size/price/stock) for a product;
  `$.tsx`'s size selector now reflects real variants (out-of-stock sizes
  disabled) and its "Add to bag" button calls `useAddToCart` for real, with
  pending/success/error states. Verified locally: real button renders (not
  disabled), real size options render with real variant ids. Deployed
  (Version `90ef3d3b`); also shrank the PDP hero image (was hardcoded to a
  broken path, silently falling back to a letter placeholder — now uses the
  real product photo, capped to `max-w-sm`) and surfaced description,
  rating/votes, release year, and gender on the PDP in the same pass.
- **Fixed: wishlist was completely unreachable from the real site.** Found
  the same way as the cart bug — same root cause pattern, same blast radius.
  `WishlistButton` (correctly wired to `useToggleWishlist`) only existed
  inside `ProductActions.tsx`/`ProductCard.tsx`, both on the same dead
  CMS-section tree as the broken cart button. `ProductTile` — the component
  actually rendered on `/`, `/fragrance`, and the PDP's "related
  products" — had no wishlist affordance at all. The mobile menu linked to
  `/wishlist`, but no such route existed (fell through to the catch-all's
  "not found" state). Fixed: added a heart-icon toggle to `ProductTile`
  (top-right overlay) and to `$.tsx`'s PDP actions row; built a real
  `src/routes/wishlist.tsx` (auth-gated like `/account`, cross-references
  `useWishlist()`'s `productIds` against `useCatalog()` to render full
  product tiles). `CatalogEntry` gained an `id` field (the real DB uuid,
  distinct from `slug`) since wishlist operates on product id, not slug.
- **Fixed: PDP price was static** — showed `entry.price` (the base catalog
  price) regardless of which size was selected, never reading
  `selectedVariant.price`. Now correctly reflects the selected variant.
- **Fixed: cart/checkout images weren't rendering.** `Minicart.tsx`,
  `cart.tsx`, and `checkout.tsx` used the wrapped `Image` component, which
  routes through an external `decoims.com` CDN proxy of unverified
  reliability for this now-identity-decoupled project (see the
  remove-deco-identity map). `ProductTile` — already proven working — uses
  a plain `<img>` with the real source URL directly; all three cart-adjacent
  views switched to match. Verified locally: real `fimgs.net` URLs render
  directly in cart/checkout markup, matching `ProductTile`'s working pattern.
- [Migrate catalog reads to sillage-api](issues/10-catalog-migration.md) —
  catalog joins cart/wishlist/address/orders in moving fully to
  `sillage-api` (reversing the original "catalog stays on `createServerFn`"
  call from ticket 01 — account/auth is unaffected, still out of scope).
  Real server-side pagination *and* filtering (not just a paginated wire
  format) on `GET /v1/products`, live per-filter facet counts (a dedicated
  facets endpoint), the header searchbar moving from client-cached-array
  search to debounced API calls, and PDP's related-products rail switching
  from arbitrary to same-family. Split into four implementation tickets
  since the actual build is well beyond one session.
- [Build sillage-api's product endpoints](issues/11-catalog-api-endpoints.md) —
  `GET /v1/products` (search/filter/sort/paginate), `/facets` (live counts
  per applied filters), `/:slug` (detail), `/:slug/variants`,
  `/related/:slug` (same-family), `/home-collections`. Verified locally
  against real seeded data (`sillage-api` commit `852df20`, pushed).
  Now deployed and live.
- [Move /fragrance to server-side filtering](issues/12-fragrance-server-side.md) —
  new `src/platform/catalog/products.hooks.ts` (`useProducts`/
  `useProductFacets`), `/fragrance`'s filter/sort/page state moved from
  local `useState` into the URL (shareable/bookmarkable), facet counts now
  live per applied filters. Caught and fixed two real bugs during
  verification: a `validateSearch` coercion bug that silently dropped
  `family`/`page` from every real URL (raw query params are strings, not
  native arrays/numbers — `?family=Woody&page=2` was being stripped down
  to `?sort=...` by the router's canonical-URL redirect), and a
  **production-only 500 crash** from an unhandled prefetch rejection in
  the new SSR loader (diagnosed via `wrangler dev --remote` since local
  `vite dev`/`wrangler dev` both masked it — see the ticket for the full
  diagnostic account). Deployed (Version `858c45b7`), confirmed 200 on the
  real production URL. SSR prefetch itself still doesn't appear to
  populate data server-side (shows "0 fragrances" at first paint), but
  **user-confirmed in a real browser**: client-side hydration recovers
  fully — count corrects, tiles render, facet counts are real, filtering
  and pagination work. Cosmetic first-paint-only gap, not a functional one;
  root cause not chased further.
- [Move header search to debounced API calls](issues/13-header-search-api.md) —
  `Searchbar/Form.tsx` no longer filters a client-cached catalog array;
  suggestions come from `useProducts({ search, limit: 6 })`, debounced
  300ms (new shared `src/sdk/useDebouncedValue.ts`, extracted from ticket
  12's local copy). No SSR loader on this component, so the class of bug
  that crashed `/fragrance` doesn't apply here. Deployed (Version
  `be2834f9`), all key routes smoke-tested 200. Not yet clicked through in
  a real browser.
- [Migrate PDP/home-collections and remove the old catalog surface](issues/14-catalog-cutover-remaining.md) —
  **could not fully delete the old catalog surface as originally scoped**:
  `discovery.tsx`'s local keyword-scoring mock genuinely needs the full
  unpaginated catalog client-side, and the user explicitly said not to
  touch that route in this pass. `getCatalogServerFn`/`getCatalogEntries`
  survive, trimmed to exactly that one consumer; everything else (PDP
  detail/variants/related, home-collections, wishlist's product
  cross-reference) is now on `sillage-api`. New `GET /v1/products?ids=...`
  batch endpoint added for wishlist (was fetching the whole catalog to
  show a handful of items). `$.tsx`/`index.tsx` both gained real SSR
  loaders using the `ensureQueryData` + per-call `.catch(() => {})`
  pattern ticket 12's postmortem established as required. Verified via
  `wrangler dev --remote` against the real built artifact (no exceptions
  in the server log across all 7 pre-deploy routes), then deployed
  (Version `f3e02650`) and smoke-tested 200 across 8 live routes. Carries
  the same known, already-user-confirmed-safe SSR-flash pattern from
  ticket 12 onto `/` and the PDP — expected to self-correct via hydration
  but not independently re-verified in a browser for these two specific
  pages.

This closes out the catalog-migration effort — all four implementation
tickets (11–14) are resolved. `discovery.tsx` staying on the old
`createServerFn` path is a deliberate, explicit exception, not an
oversight — see fog below.

## Not yet specified

- Whether/when `discovery.tsx` moves off the old catalog `createServerFn`
  surface too — deliberately deferred per explicit user instruction during
  [ticket 14](issues/14-catalog-cutover-remaining.md), not forgotten. It
  needs the *entire* unpaginated catalog for its local keyword-scoring
  mock, which doesn't fit `/v1/products`' pagination model as-is; revisit
  if/when Discovery gets real backend logic (already out of scope on the
  sillage-redesign map) or a "give me everything" catalog endpoint is
  otherwise justified.
- OpenAPI/schema documentation for the new routes — not sharp until the
  endpoint surface itself is designed.
- Rate limiting on `sillage-api` — not urgent while the only consumer is the
  known website, revisit if/when a real external consumer (mobile app,
  partner) is scoped in. (CORS, previously grouped with this, is no longer
  deferred — see ticket 01's amendment.)
- Cleaning up the dead legacy wishlist/address cookie-backed code
  (`src/actions/{wishlist,address}/submit.ts`, `src/loaders/wishlist.ts`,
  the wishlist/address halves of `src/loaders/_cookie.ts`, their `setup.ts`
  registrations) — fixed to keep typechecking during the cutover but not
  removed, since deleting Deco block registrations without being able to
  verify the block-generation build step felt too risky to do blind.

## Out of scope

_(none yet)_
