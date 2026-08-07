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
  as `c25a2b5`, not yet pushed/deployed), reusing the website's existing
  Hyperdrive config via a second binding. `/v1/cart`, `/v1/wishlist`,
  `/v1/addresses`, `/v1/orders` implemented (not left as stubs) against
  tickets 02/03's exact contract, plus bearer-token middleware and CORS.
  Website repo's `src/db/auth.ts` now enables Better Auth's bearer plugin.
  Both repos typecheck clean; `sillage-api` verified with `wrangler deploy --dry-run`
  only — nothing deployed live, nothing on the frontend calls it yet.

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
  a new `src/platform/orders` module adds checkout (`useCheckout`) with no
  consuming UI yet. Bearer token captured from Better Auth's `set-auth-token`
  header into `localStorage` on sign-in/sign-up. Root route's SSR cart
  prefetch removed entirely — see fog below. Both repos typecheck clean;
  not exercised against a live `sillage-api` (still undeployed).

## Not yet specified

- OpenAPI/schema documentation for the new routes — not sharp until the
  endpoint surface itself is designed.
- Rate limiting on `sillage-api` — not urgent while the only consumer is the
  known website, revisit if/when a real external consumer (mobile app,
  partner) is scoped in. (CORS, previously grouped with this, is no longer
  deferred — see ticket 01's amendment.)
- Guest cart identity during SSR. A first-time guest has no cart-session id
  for SSR to forward (that id is only minted client-side, on the browser's
  first cart write) — the root route's cart prefetch was removed entirely
  rather than built against a half-working mechanism (ticket 06's answer
  only solves the *authenticated* SSR case). `useCart()` now fetches
  client-side only, after hydration; guests briefly see `EMPTY_CART`
  placeholder data. Not yet a ticket — the likely fix ("just accept the
  post-hydration flash" vs. some other mechanism) doesn't have a forcing
  function yet.
- A real checkout UI. `useCheckout()` (orders module) exists and is fully
  wired to `POST /v1/orders`, but nothing calls it — both "Checkout" buttons
  (cart page, minicart) render permanently disabled. This is real,
  user-visible unfinished work, not a nice-to-have.
- Deploying `sillage-api` for real (Cloudflare + pushing the repo to GitHub).
  The frontend code is now ready and waiting on this — deploying is what
  would actually let the cutover be exercised/verified end-to-end.
- Cleaning up the dead legacy wishlist/address cookie-backed code
  (`src/actions/{wishlist,address}/submit.ts`, `src/loaders/wishlist.ts`,
  the wishlist/address halves of `src/loaders/_cookie.ts`, their `setup.ts`
  registrations) — fixed to keep typechecking during the cutover but not
  removed, since deleting Deco block registrations without being able to
  verify the block-generation build step felt too risky to do blind.

## Out of scope

_(none yet)_
