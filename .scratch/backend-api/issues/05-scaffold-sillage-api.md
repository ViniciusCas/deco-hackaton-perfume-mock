# Scaffold the sillage-api repository

Type: task
Status: resolved

## Question

Not a decision — the work needed before implementation of [the endpoint
surface](02-endpoint-surface-design.md) can start. Create the `sillage-api`
repository (per [ticket 01's amendment](01-relationship-to-server-fn.md))
and get it to a deployable, empty-but-wired state:

- New repo (e.g. `~/dev/hackaton-deco/sillage-api`, GitHub under the same
  account), Hono on Cloudflare Workers.
- `wrangler.jsonc` with a Hyperdrive binding to the same `sillage-hackaton-db`
  RDS instance this repo already uses.
- Its own copy of `src/db/schema.ts` (duplicated per ticket 01's decision)
  and a Drizzle client setup mirroring this repo's `src/db/client.ts`.
- `/v1` route scaffolding for the four domains (`cart`, `wishlist`,
  `addresses`, `orders`) per [the endpoint surface](02-endpoint-surface-design.md)
  and [contract conventions](03-contract-conventions.md) — route files/handlers
  can start as stubs; this ticket is about the scaffold being live and
  deployable, not the full business logic.
- CORS configured for the website's origin(s) (production + local dev).
- Bearer-token validation middleware (direct `session`-table lookup, per
  ticket 01) wired in for the routes that need it.
- Enable Better Auth's bearer plugin in **this** repo (`src/db/auth.ts`) so
  sign-in/sign-up responses carry a token the website can hold and forward.

## Answer

**Done.** New repo at `~/dev/hackaton-deco/sillage-api` (git-initialized,
not yet pushed to GitHub), committed as `c25a2b5`.

- **Stack**: Hono `4.6.14` on Cloudflare Workers, `wrangler.jsonc` with a
  `HYPERDRIVE` binding reusing the *same* Hyperdrive config id
  (`5ffc8bf2c071488eab04135667fce6f3`) the website Worker already uses —
  one Hyperdrive config can back multiple Workers, so no new Cloudflare
  resource was provisioned, just a second binding to the existing one.
  `wrangler deploy --dry-run` confirms it builds and both bindings
  (`HYPERDRIVE`, `ALLOWED_ORIGINS`) resolve correctly.
- **Schema**: `src/db/schema.ts` copied verbatim from the website repo, with
  its header comment rewritten to say this copy doesn't own migrations —
  the website repo's `drizzle-kit` flow does, this file exists only for
  typed queries against the same live tables.
- **DB client**: `src/db/client.ts` mirrors the website repo's Hyperdrive
  quirks exactly (`prepare: false`, no `ssl` key, `fetch_types: false`),
  reading the binding from Hono's `c.env` instead of `cloudflare:workers`
  (this repo has no `createServerFn`/SSR context to pull env from ambiently).
- **Auth middleware** (`src/middleware/auth.ts`): `attachUser` reads
  `Authorization: Bearer <token>`, looks it up directly in the shared
  `session` table (checking `expiresAt`), and sets it on Hono's context;
  `requireUser` 401s if that lookup didn't populate a user. Matches ticket
  01's decision to validate without running Better Auth.
- **Routes implemented** (not left as bare stubs — the endpoint design from
  [ticket 02](02-endpoint-surface-design.md) and conventions from
  [ticket 03](03-contract-conventions.md) were concrete enough to build
  against directly):
  - `src/routes/cart.ts` — guest identity via `X-Cart-Session` header or an
    auto-created cart on first request; `GET/POST /items/PATCH/DELETE items/:itemId`.
  - `src/routes/wishlist.ts` — ungated `GET` (empty for guests), `POST`/`DELETE /:productId` behind `requireUser`.
  - `src/routes/addresses.ts` — full CRUD + `/:id/default`, all behind
    `requireUser`, enforcing the single-default invariant server-side.
  - `src/routes/orders.ts` — checkout: resolves the caller's cart, rejects
    empty carts and insufficient stock (naming the offending variant),
    resolves `addressId` (must belong to the caller) or ad-hoc shipping
    fields, requires `guestEmail` when unauthenticated, snapshots
    title/size/price onto `orderItems`, decrements `productVariants.stock`,
    clears the cart, returns the created order.
  - `src/index.ts` — mounts all four under `/v1`, applies `attachUser`
    globally, CORS restricted to `ALLOWED_ORIGINS` (website's production +
    local-dev origins), `/health` check.
  - `src/lib/respond.ts` — `ok()`/`fail()` helpers implementing ticket 03's
    `{ data }` / `{ error: { code, message, details? } }` envelopes.
- **Bearer plugin enabled in the website repo**: `src/db/auth.ts` now
  imports `bearer` from `better-auth/plugins` and adds `plugins: [bearer()]`
  to `betterAuth({...})` — sign-in/sign-up responses now carry a
  `set-auth-token` header alongside the existing cookie. Verified via
  `tsc --noEmit` on the website repo (clean).
- **Verification**: both repos typecheck clean (`npx tsc --noEmit`);
  `sillage-api`'s `wrangler deploy --dry-run` succeeds and resolves both
  bindings. Not yet deployed for real, and not yet exercised against a live
  database (no request was actually made).

**Explicitly not done here** (deferred, listed so nothing is silently
assumed complete):
- Nothing in `sillage-api` has been deployed to Cloudflare or pushed to
  GitHub — it's a local, committed, but unpublished repo.
- The website's frontend (`cart.hooks.ts`, `wishlist.hooks.ts`,
  `address.hooks.ts`, and a new orders/checkout flow) still calls the old
  Shopify/`invoke.site.*` plumbing — nothing on the client side points at
  `sillage-api` yet. That's the actual cutover work and wasn't in this
  ticket's scope (this ticket was the API-side scaffold only).
  `user.actions.ts` also doesn't yet forward the `set-auth-token` header to
  the client the way it forwards `Set-Cookie` — needed before the frontend
  can hold and send a bearer token at all.
- The SSR-prefetch-before-token-exists question (logged as fog on the map)
  is still open and now directly blocks wiring `useCart`'s root-route
  prefetch to `sillage-api`.
- No `db:generate`/migration tooling was set up in `sillage-api` on purpose
  (it doesn't own migrations, per ticket 01).
