# Migrate PDP/home-collections reads and remove the old catalog createServerFn surface

Type: task
Status: resolved
Blocked by: 11

## Question

The remaining catalog read paths not covered by [ticket 12](12-fragrance-server-side.md)
(`/fragrance`) or [ticket 13](13-header-search-api.md) (header search):
- `src/routes/index.tsx` (home page arrivals/best sellers) →
  `GET /v1/products/home-collections`.
- `src/routes/$.tsx` (PDP: product detail, variants, related products) →
  `GET /v1/products/:slug`, `GET /v1/products/:slug/variants`, and
  `GET /v1/products?family=...&limit=4` for related products (per
  [ticket 10](10-catalog-migration.md)'s answer).
- `__root.tsx`'s catalog prefetch in `beforeLoad` — becomes whichever SSR
  wrapper(s) the above need, per ticket 10's `createServerFn`-wrapper
  pattern (mirrors `getCartSsrServerFn`).

Once all consumers are migrated: delete `src/platform/catalog/catalog.actions.ts`,
`src/db/queries.ts`, and the old `CatalogEntry`-array-shaped hooks/types
that are no longer used, per ticket 10's "full replace" decision.

## Answer

**Scope changed mid-ticket**: while grilling this, the user explicitly
said not to touch `discovery.tsx` right now. That route needs the *entire*
unpaginated catalog client-side for its local keyword-scoring mock — a
real, separate design fork from everything else in this ticket (paginated
list vs. "give me everything"). Since it's explicitly deferred, the old
`createServerFn` catalog surface **could not be fully deleted** as
originally scoped — `getCatalogServerFn`/`getCatalogEntries` stay alive,
trimmed down to exactly what `discovery.tsx` needs and nothing else.

A second real design fork surfaced too: `wishlist.tsx` was fetching the
*entire* catalog just to cross-reference a handful of wishlisted product
ids — wasteful and, once the old full-catalog fetch is gone, has no
natural replacement in a paginated `/v1/products`. Resolved by adding a
**batch-by-ids endpoint**: `GET /v1/products?ids=a,b,c` on `sillage-api`
(comma-separated, not repeated params — simpler to build via
`URLSearchParams`), bypassing search/filter/sort/pagination entirely.

**Shipped**:
- `sillage-api`: `GET /v1/products?ids=...` added to `products.ts`,
  deployed (Version `9b3a6fe2`).
- `src/platform/catalog/products.hooks.ts` extended with
  `useProductsByIds`, `useProductDetail`/`fetchProductDetail`,
  `useProductVariants`/`fetchProductVariants`,
  `useRelatedProducts`/`fetchRelatedProducts`,
  `useHomeCollections`/`fetchHomeCollections` — each exposing both a hook
  (component use) and a bare fetch fn + query-key constant (for route
  loaders to prefetch with the identical cache key, matching the
  `PRODUCTS_QUERY_KEY`/`fetchProducts` pattern ticket 12 established).
- `src/routes/wishlist.tsx` — `useCatalog()` + client-side `.filter()`
  replaced with `useProductsByIds(wishlist.productIds)`.
- `src/routes/$.tsx` — fully off the old `createServerFn` catalog surface.
  Gained its **own SSR loader** (it didn't have client-hook-only rendering
  before this ticket — the original always had a loader), now prefetching
  detail/variants/related via `ensureQueryData` + individual
  `.catch(() => {})` per call, matching the exact pattern ticket 12's
  postmortem established as required (an unhandled rejection through a
  route loader previously crashed `/fragrance` in production). Related
  products now come from `GET /v1/products/related/:slug` (same-family,
  per [ticket 10](10-catalog-migration.md)'s answer) instead of an
  arbitrary catalog slice.
- `src/routes/index.tsx` — same treatment: `getHomeCollectionsServerFn`
  replaced with a loader prefetching `fetchHomeCollections` (same
  `.catch(() => {})` pattern) plus `useHomeCollections()` in the
  component. Added an explicit loading guard (`ARRIVALS.length === 0`)
  since the hero section unconditionally reads `ARRIVALS[0]` — previously
  safe because the old loader always resolved data before first render;
  now genuinely needed since the client-side hook can render before its
  query resolves.
- `__root.tsx`'s `beforeLoad` — removed the whole-catalog prefetch
  entirely (`CATALOG_QUERY_KEY`/`getCatalogServerFn` block). Nothing
  outside `discovery.tsx`'s own dedicated loader consumes it anymore.
- **Trimmed, not deleted**: `catalog.actions.ts` now exports only
  `getCatalogServerFn`; `src/db/queries.ts` now exports only
  `getCatalogEntries` (dropped `getProductBySlug`, `getProductVariantsBySlug`,
  `getHomeCollections` — all fully migrated to `sillage-api`).
  `catalog.hooks.ts` (`useCatalog`) deleted outright — it had zero
  remaining consumers once `wishlist.tsx` moved to `useProductsByIds`.
  `discovery.tsx` now imports `getCatalogServerFn` directly from
  `./catalog.actions` rather than through the barrel, since the barrel
  (`platform/catalog/index.ts`) no longer re-exports it — a deliberate
  signal that this is a narrow, named exception, not a supported general
  import path.

**Verification**: both repos typecheck and build clean. Verified via
`wrangler dev --remote` against the real built artifact (the reproduction
method ticket 12 established as necessary — local `vite dev`/`wrangler dev`
previously masked a production-only crash) — all seven key routes (`/`,
a real PDP slug, `/fragrance`, `/discovery`, `/wishlist`, `/account`,
`/cart`) returned 200 with **no exceptions in the server log**.
`discovery.tsx` (untouched) correctly still renders "Scent assistant"
content server-side; `/wishlist`'s auth gate correctly renders "not signed
in" for a guest.

**Known, already-accepted gap carried over from ticket 12**: `/` and the
PDP route both show a loading spinner / no product content in the raw
SSR'd HTML (same class of issue as `/fragrance`'s "0 fragrances" flash) —
crash-free, but the SSR prefetch doesn't visibly resolve into rendered
content within the SSR snapshot. Given the user already confirmed in a
real browser that this exact pattern self-corrects via client-side
hydration for `/fragrance`, the same is *expected* to hold here (same
mechanism, same `.catch()` safety net) — but this specific claim for `/`
and the PDP was **not independently re-verified in a browser** as part of
this ticket. Worth a spot-check.

Deployed: website Version _(pending — see below)_.
