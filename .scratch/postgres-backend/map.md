# Postgres backend for the storefront

## Destination

The perfume storefront's data — catalog (products) and the storefront operations that touch it (cart, wishlist, accounts, orders) — persist in a real Postgres database (AWS RDS, already provisioned as `sillage-hackaton-db`) instead of the static `perfumes.json`/`catalog.ts` mock and the currently-unconfigured Shopify integration. Schema lives as Drizzle ORM tables; the app reaches RDS via Cloudflare Hyperdrive from `createServerFn` server functions (the existing API pattern in this repo); catalog data is seeded once from `perfumes.json` and the mock is then retired.

## Notes

- Domain: `deco-hackaton-perfume-mock` (TanStack Start + React 19, deployed to Cloudflare Workers, see [Rebrand to Sillage](../remove-deco-identity/map.md)).
- **API layer is already decided by the existing codebase**: `createServerFn` (`@tanstack/react-start`) is the established pattern (see `src/platform/cart/cart.actions.ts`) — reuse it, don't invent a parallel API layer.
- **Discovery**: `src/platform/{cart,user,wishlist,address}` already call through `@decocms/apps-shopify` (real Shopify Storefront/Customer API shapes — `ShopifyCart`, etc.), but no Shopify credentials exist in `.env` — at runtime these fall back to `EMPTY_CART`/unauthenticated. This is not a working backend today, just Shopify-shaped plumbing wired to nothing. "Full storefront backend" scope means this plumbing gets replaced with Postgres-backed equivalents, not layered on top of Shopify.
- RDS instance already provisioned (outside this map, by the user): `sillage-hackaton-db.cgnkm2gganse.us-east-1.rds.amazonaws.com`, Postgres, free tier (`db.t3/t4g.micro`), master user `postgres`.
- The app runs on Cloudflare Workers — a Worker can't hold a raw long-lived TCP socket to RDS — so DB access from deployed code goes through **Cloudflare Hyperdrive**, not a direct `pg` connection.
- ORM: **Drizzle** (decided in charting). Data migration: **one-time seed script from `perfumes.json`, then the mock is retired** (decided in charting).
- Catalog columns: `RawPerfume` in `src/mocks/catalog.ts` is the actual source shape (`id, name, brand, release_year, gender, accords, notes_top, notes_middle, notes_base, rating, votes, description, image_url`); `CatalogEntry` is a *derived* view (slug, family, notes, mood, price, tag) computed from it at load time — schema design needs to decide what's a stored column vs a computed/derived query.
- Tracker: local-markdown (`.scratch/`), same fallback as [Rebrand to Sillage](../remove-deco-identity/map.md) — GitHub Issues are disabled on this repo.
- Confirmed in [Design the Postgres schema for catalog + commerce](issues/01-schema-design.md): no payment processing — an order is just a persisted row with a minimal `placed`/`cancelled` status, guest checkout allowed.

## Decisions so far

- [Design the Postgres schema for catalog + commerce](issues/01-schema-design.md) — 9 tables + `order_status` enum, written to `src/db/schema.ts`; guest-friendly carts/checkout, account-only wishlist, editable stored catalog price/derived fields, real product variants (size/price/stock), soft-deleted products, order-line price/title snapshots.
- [Provision Cloudflare Hyperdrive for the RDS instance](issues/03-provision-hyperdrive.md) — Hyperdrive config `sillage-hyperdrive` created and bound in `wrangler.jsonc`; verified with a real deployed query. Key gotcha: `postgres.js` needs `prepare: false` + no `ssl` key at all against Hyperdrive (Hyperdrive terminates TLS itself). Local dev remains broken (see Not yet specified).
- [Set up Drizzle ORM + drizzle-kit](issues/04-drizzle-setup.md) — `src/db/client.ts`/`drizzle.config.ts` added; `npm run db:generate` produced and applied the first migration (all 9 tables live in RDS). `drizzle-kit migrate`/`push` hang against this RDS instance for unknown reasons (bare `postgres.js` doesn't) — schema changes go through `db:generate` + manual `psql` apply until that's debugged further.
- [Seed the catalog table from perfumes.json](issues/05-seed-catalog.md) — `scripts/seed-catalog.ts`; 354 products + 1062 variants (30/50/100 ml) seeded, idempotent. Caught and fixed a real source-data gap (`""` instead of numbers for `release_year`/`rating`/`votes` on 60-68 rows) that `catalog.ts` had silently coerced away.
- [Cut over catalog reads from the mock to Postgres](issues/06-cutover-catalog.md) — new `src/platform/catalog/` module (server fns + `useCatalog()` hook), prefetched into the query cache at the root route like cart/user. All 5 consumers (`/`, `/fragrance`, `/$`, `/discovery`, header `Searchbar`) switched over; `src/mocks/catalog.ts` deleted, `perfumes.json` kept (still the seed source). Verified against the real deployed site.
- [Decide the accounts/auth model](issues/02-auth-model.md) — **implemented.** Auth runs on **Better Auth** (Drizzle adapter, `src/db/auth.ts`), not hand-rolled password hashing/sessions. The hand-rolled `customers` table (ticket 01) is gone — replaced by Better Auth's own `user`/`session`/`account`/`verification` tables in `src/db/schema.ts`, with `given_name`/`family_name` as additional fields on `user`. Every FK that pointed at `customers.id` now points at `user.id` (and changed `uuid` → `text`, Better Auth's id type). `src/platform/user/user.actions.ts` calls `auth.api.*` directly and forwards its `Set-Cookie` headers by hand (Better Auth isn't mounted as an HTTP route here); the exported function names and `Person` shape didn't change, so `login.tsx`/`account.tsx`/`user.hooks.ts` needed no rewiring beyond dropping the password-reset flow (explicitly out of scope, ticket 02). Email+password only, no verification/magic-link/OAuth. Verified end-to-end against the local Postgres container: sign-up persists a row, session cookie round-trips through `getSession`, sign-in works, wrong password rejected cleanly. Cart/wishlist/address are still unconnected Shopify-shaped plumbing — wiring signed-in identity into them is ticket 07's job.

## Not yet specified

- Local dev DB story: [Provision Cloudflare Hyperdrive for the RDS instance](issues/03-provision-hyperdrive.md) found that local `vite dev`/`wrangler dev` connects *directly* to RDS (bypassing Hyperdrive's TLS termination) via `.dev.vars`'s local connection string, and that any SSL negotiation attempt hangs in the local Miniflare socket layer — a real, unresolved bug distinct from the production fix. Options for whoever picks this up: live with deploy-to-test for DB routes, run a local/dockerized Postgres instead of pointing at RDS, or revisit after a wrangler/vite-plugin update. Not yet a ticket because it's not clear which option is right until [Set up Drizzle ORM + drizzle-kit](issues/04-drizzle-setup.md) and [Cut over catalog reads](issues/06-cutover-catalog.md) show how much local dev friction it actually causes.
- Why `drizzle-kit migrate`/`push` hang against `sillage-hackaton-db` specifically (see [Set up Drizzle ORM + drizzle-kit](issues/04-drizzle-setup.md)) — not chased down; workaround (`db:generate` + manual `psql` apply) is fine for this project's pace but worth revisiting if it becomes painful across many migrations.
- Whether the Shopify-shaped types (`ShopifyCart`, etc.) in `src/platform/*` get deleted outright or kept as a compatibility shape during cutover — depends on how ticket 07 approaches the swap.

## Out of scope

- [Cut over cart/account/wishlist off the Shopify plumbing](issues/07-cutover-commerce.md) —
  superseded by [A real HTTP backend API for the storefront](../backend-api/map.md),
  which does the same cart/wishlist/address/orders wiring directly as HTTP
  routes instead of `createServerFn`. Closed rather than resolved here.
