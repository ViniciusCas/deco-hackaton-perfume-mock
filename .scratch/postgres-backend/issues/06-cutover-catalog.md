# Cut over catalog reads from the mock to Postgres

Type: task
Status: resolved
Blocked by: 01, 04, 05

## Question

Replace every place that currently imports `CATALOG`/`RawPerfume` from `src/mocks/catalog.ts` — `src/routes/fragrance.tsx`, the `$` splat PDP route, `ProductCardVariants`, home-page sections, the searchbar's suggestion list — with `createServerFn` calls that query the seeded `products` table via Drizzle. Preserve existing behavior (filters, sort, pagination, search-suggestion matching on name/brand/family/notes) — this is a data-source swap, not a UX change. Once nothing imports `src/mocks/catalog.ts`/`perfumes.json` anymore, delete them.

## Answer

Built a new `src/platform/catalog/` module (mirroring the existing `platform/cart`/`platform/user` scaffold): `catalog.types.ts` (moved `CatalogEntry`), `catalog.actions.ts` (`createServerFn` wrappers around new `src/db/queries.ts`, which does the actual Drizzle reads server-side), `catalog.hooks.ts` (`useCatalog()`, a `useQuery` over the catalog keyed `["catalog"]`).

**Data flow, matching the existing cart/user pattern exactly**: `__root.tsx`'s `beforeLoad` now also prefetches the catalog into the shared `queryClient` (same as cart/user), so the header's `Searchbar` — a global component with no route loader of its own — always has a warm, cached catalog on every page. Route-specific pages (`/`, `/fragrance`, `/discovery`, `/$`) additionally use their own route `loader` for SSR-safe first paint (no client-fetch flash), matching prior synchronous-`CATALOG`-import behavior:
- `/` (index.tsx): `getHomeCollectionsServerFn()` replaces `ARRIVALS`/`BEST_SELLERS` (same derivation: 4 newest by release year, 4 most-voted excluding arrivals).
- `/fragrance`: switched to `useCatalog()` — filters/sort/pagination/search all stay 100% client-side over the fetched array, same as before, just DB-sourced now instead of a bundled import.
- `/$` (PDP + catch-all): loader fetches both the specific product (`getProductBySlugServerFn`) and the full catalog (for "related" tiles) in parallel; 404 case (`entry === null`) unchanged.
- `/discovery`: loader fetches the catalog once; `scoreReply()` (client-side keyword scoring, still a scripted mock — no AI) now takes `catalog` as a parameter instead of closing over a module constant.
- `Searchbar/Form.tsx`: switched to `useCatalog()` — no per-keystroke network call, filtering still instant against the already-cached array.

`ProductCardVariants` (named in this ticket's original body) turned out to be unrelated — it's part of `@decocms/apps-commerce`'s generic product-card system, never imported `src/mocks/catalog`.

**Deleted `src/mocks/catalog.ts`** (fully unused now). **Kept `src/mocks/perfumes.json`** — it's still the seed source of truth for `scripts/seed-catalog.ts` (ticket 05), not dead weight.

**Verified against the real deployed Worker** (local dev's DB access is still broken per ticket 03's fog): home page shows real product names/prices from RDS; `/fragrance` reports "354 fragrances" (matches `select count(*)`); a real PDP slug (`/adultere-a-berger-parfums`) renders correctly; `/discovery`'s initial recommended list shows real DB-sourced products; typecheck clean throughout.
