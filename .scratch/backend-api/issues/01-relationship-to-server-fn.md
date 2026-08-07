# Decide how this API relates to the existing createServerFn actions and ticket 07

Type: grilling
Status: resolved (amended)

## Question

The storefront already has (or is mid-building, via [Cut over cart/account/wishlist
off the Shopify plumbing](../../postgres-backend/issues/07-cutover-commerce.md))
a full backend surface as `createServerFn` RPC actions: `src/platform/{cart,user,wishlist,address,catalog}/*.actions.ts`.
This map's destination is the same functional surface reachable as real HTTP
routes instead. Three ways this can go, and this ticket picks one (or a mix
per domain):

1. **Replace** — new `/api/*` route handlers become the only backend; the
   `createServerFn` actions are deleted and frontend hooks (`useCart`,
   `useUser`, etc.) switch to calling the HTTP routes via `fetch`/React Query.
   Ticket 07 is superseded (close it, log as out-of-scope-by-supersession on
   the Postgres-backend map) rather than separately implemented.
2. **Wrap** — the HTTP route handlers become thin adapters that call into the
   same logic as (or literally call) the existing/planned `createServerFn`
   actions, so both entry points stay live. Ticket 07 proceeds independently
   (still needed for the RPC side) and this map adds the HTTP face on top once
   07 lands.
3. **Coexist, scoped down** — this map only builds HTTP routes for a subset
   (e.g. read-only catalog, or whichever domain has an external-consumer
   reason to exist as HTTP), leaving the rest on `createServerFn` only.

Also decide: do already-shipped `createServerFn` domains (catalog, account/auth)
get an HTTP-route face in this pass, or does this map start with the
not-yet-built domains (cart/wishlist/address/orders) and catalog/auth follow
later as a fog item?

## Answer

**Replace, scoped to the not-yet-built domains.**

1. **Strategy: Replace, not Wrap.** `createServerFn` is being phased out as
   the storefront's backend, not kept as a permanent second surface. Real
   `/api/*` HTTP routes are the destination; there's no long-term dual-RPC-and-HTTP
   architecture to maintain.
2. **Scope for this pass: cart, wishlist, address, orders.** These are the
   domains with nothing real behind them yet — `cart.actions.ts` calls
   `@decocms/apps-shopify` against no configured credentials, `wishlist` calls
   a separate legacy `invoke.site.loaders.wishlist()` runtime (not even
   `createServerFn`); `address` is the same shape as wishlist — a legacy
   `invoke.site.*` module (`src/platform/address/`) backed by a
   `deco_addresses` cookie, not Postgres; `orders` doesn't exist as a module
   or route at all — `cart.tsx`'s "Checkout" button links to
   `cart.checkoutUrl`, a Shopify external checkout URL that's always `null`
   today. All four get built fresh, directly as HTTP route handlers backed by
   Postgres — not ported from an intermediate `createServerFn` version first.
3. **Catalog and account/auth are explicitly out of this pass.** Both are
   real, working, in production on `createServerFn` (see the Postgres-backend
   map's decisions for [catalog cutover](../../postgres-backend/issues/06-cutover-catalog.md)
   and [the auth model](../../postgres-backend/issues/02-auth-model.md)).
   Migrating them to `/api/*` is deferred — tracked as fog on this map, not a
   ticket yet, since there's no pressure to touch working code in this wave.
4. **Ticket 07 on the Postgres-backend map is superseded.** Its job — wiring
   cart/wishlist/address off the Shopify-shaped plumbing onto Postgres, using
   the auth mechanism from ticket 02 — is now done here, directly as HTTP
   routes, instead of as a `createServerFn` implementation first. Closed as
   out-of-scope-by-supersession on that map (see its Out of scope section).
   Orders wasn't in ticket 07's original scope by name but falls out of the
   same cart→order flow it described ("turning a cart into a persisted
   order") — folded into this map's scope alongside cart/wishlist/address
   rather than left as a separate future ticket.

This unblocks [Design the endpoint surface](02-endpoint-surface-design.md)
and [Decide the shared HTTP contract conventions](03-contract-conventions.md):
both now know their scope is exactly {cart, wishlist, address, orders}.

---

## Amendment: the backend lives in a separate repository

**Superseding fact, surfaced after the above was first resolved**: the new
API is not `/api/*` routes inside this repo — it's a **separate repository**,
`sillage-api` (doesn't exist yet; created fresh, e.g. at
`~/dev/hackaton-deco/sillage-api`). Everything above about *scope* (cart,
wishlist, address, orders move; catalog/auth stay on `createServerFn` in this
repo; ticket 07 superseded) **still holds** — only the *transport and
location* changed. The `server.handlers` finding from the original charting
session is now historical context, not the plan: it was true and useful for
scoping ("real HTTP routes are technically possible here") but this repo
won't host those routes itself.

What the split changes, decided in this amendment round:

1. **New repo stack**: **Hono on Cloudflare Workers**. Chosen over
   TanStack Start again (too heavy for an API-only service with no frontend)
   and plain unframeworked Workers (Hono's routing/middleware is worth the
   one dependency). Doesn't exist yet — needs creating from scratch.
2. **Database access**: its own **Hyperdrive binding** to the same
   `sillage-hackaton-db` RDS instance used by this repo — same platform
   (Cloudflare), same DB, separate binding/connection.
3. **Schema**: **duplicated**, not shared as a package. The new repo gets its
   own copy of `src/db/schema.ts` for its own Drizzle setup. Accepted
   drift risk in exchange for zero cross-repo package/publishing overhead —
   proportionate to a hackathon's pace; revisit if the schema starts
   changing often enough that hand-syncing two copies gets painful.
4. **Cross-origin auth: bearer token, not cookie.** The API is now a genuine
   separate origin, so Better Auth's session cookie (this repo's own,
   `sillage`-prefixed) doesn't ride along for free. This repo enables
   **Better Auth's bearer plugin** — sign-in/sign-up responses gain a session
   token in a header, *alongside* the existing cookie (which keeps working
   unchanged for this repo's own `createServerFn` calls to catalog/auth).
   The website holds that token in memory and sends
   `Authorization: Bearer <token>` on every call to `sillage-api`.
5. **Token validation in the new repo**: `sillage-api` does **not** run
   Better Auth itself. It validates an incoming bearer token by querying the
   shared `session` table directly (`token`, `userId`, `expiresAt` — already
   covered by decision #3's schema duplication) via its own Drizzle
   connection, checking expiry by hand. Simpler than duplicating Better
   Auth's own config/adapter setup for a service that only ever *reads* a
   session, never issues one.
6. **Guest cart identity follows the same token-not-cookie logic.** Carts
   support guests (schema's nullable `customerId` + `sessionToken`), and a
   cross-site cookie for that has the same third-party-cookie fragility the
   auth cookie would have had. Instead: `sillage-api` returns an opaque cart
   session id in the response body on first cart write; the website stores
   it (e.g. `localStorage`) and sends it back as a custom header (e.g.
   `X-Cart-Session`) on subsequent `/cart` calls.
7. **CORS moves from deferred fog into real, immediate scope.** The map's
   original charting assumed CORS could wait because "the only consumer is
   the same-origin website" — that assumption is now false, the website and
   `sillage-api` are different origins by construction. `sillage-api` needs
   an explicit allowed-origin config for the website's domain(s). Because
   auth is header-based (bearer token + custom cart header) rather than
   cookie-based, this is a plain origin allow-list — no
   `Access-Control-Allow-Credentials` / `SameSite` complexity to reason
   about.

This amendment doesn't touch [Design the endpoint surface](02-endpoint-surface-design.md)'s
or [Decide the shared HTTP contract conventions](03-contract-conventions.md)'s
scope (still {cart, wishlist, address, orders}) — it changes *where* those
routes are designed to live and *how* they authenticate, which those tickets
should build against directly rather than re-deciding.
