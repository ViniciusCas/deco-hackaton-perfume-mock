# Move /fragrance to server-side filtering and pagination

Type: task
Status: resolved
Blocked by: 11

## Question

Rework `src/routes/fragrance.tsx`: replace client-side filtering (family/
brand checkboxes, price buckets, text search), sorting, and pagination
(currently all computed from `useCatalog()`'s fully-cached array) with
query-string-driven state that calls `GET /v1/products` and
`GET /v1/products/facets` (from [ticket 11](11-catalog-api-endpoints.md))
directly. Filter/sort/page state should live in the URL (already partially
true — `q` is a search param today) so filtered views are shareable/
bookmarkable, matching how the route already handles `?q=`. Facet checkbox
counts come from the facets endpoint, not computed locally. Preserve the
existing page-size (24) and pagination UI (`pageWindow` helper) — same UX,
different data source.

## Answer

**Shipped**: `src/platform/catalog/products.hooks.ts` (new) —
`useProducts(filters)` and `useProductFacets(filters)`, both thin React
Query wrappers over `sillageApiFetch` against ticket 11's endpoints, with
a shared `buildQueryString` helper handling repeatable `family`/`brand`
params. `src/routes/fragrance.tsx` rewritten:

- **Filter/sort/page state now lives in the URL** (`validateSearch`
  extended: `q`, `family[]`, `brand[]`, `price` (bucket key), `sort`,
  `page`), not local `useState` — shareable/bookmarkable, per the ticket's
  ask. Filter clicks call `navigate({ search: ..., replace: true })` rather
  than pushing a new history entry per toggle.
- Price buckets now map to `priceMin`/`priceMax` sent to the API instead of
  a local `.test(price)` predicate.
- Facet checkbox counts come from `useProductFacets` (live, per
  currently-applied filters) instead of a local `Map` built from the full
  cached catalog.
- Removed entirely: the `filtered`/`sortEntries`/local-pagination `useMemo`
  chain — `items`/`total`/`totalPages` come directly from the API response.
- The header-driven `q` search param is debounced (300ms) before being
  sent as the API's `search` param — no per-keystroke request storm, even
  though `fragrance.tsx` itself has no text input (the header searchbar
  owns that; `q` only changes via full navigation).
- `ProductTile` (grid item) is unchanged — it already worked fine against
  `CatalogEntry`, which the new `useProducts` still returns.

**Verified locally end-to-end** (Docker Postgres + both dev servers) —
caught and fixed two real bugs in the process, not just confirmed the
happy path:

1. **SSR flash regression, found and fixed.** The initial implementation
   had no SSR prefetch for `/fragrance` — `useProducts`/`useProductFacets`
   are plain client-side React Query hooks, so the very first server-rendered
   paint showed "0 fragrances" until hydration resolved. Unlike cart, this
   needed **no `createServerFn` wrapper**: `sillageApiFetch` has zero
   server-only imports (confirmed by inspection — no `@tanstack/react-start/server`
   import anywhere in its module), so a plain route `loader` + `loaderDeps`
   (mirroring the URL's search params) prefetching via
   `context.queryClient.ensureQueryData` works directly and still passes
   `npm run build`'s import-protection check. This means [ticket 10](10-catalog-migration.md)'s
   assumption that *every* SSR catalog read needs the heavier
   `createServerFn`-wrapper pattern was too cautious for the read-only,
   no-auth case — worth remembering for [ticket 14](14-catalog-cutover-remaining.md).
2. **Real correctness bug in `validateSearch`, found and fixed.** It assumed
   `family`/`brand` arrive as native arrays and `page` as a native number —
   but raw URL query params are always strings (`?family=Woody` parses to
   the string `"Woody"`, not `["Woody"]`; `?page=2` parses to `"2"`, not
   `2`). The `typeof`/`Array.isArray` checks silently failed for every real
   URL, TanStack Router's canonical-URL redirect stripped the "invalid"
   params, and a request for `?family=Woody&page=2` silently became
   `?sort=price-asc` with `family`/`page` gone — the family filter and
   pagination were completely non-functional for anyone following a link
   or bookmark, not just a theoretical shareability gap. Fixed with
   explicit string→array/string→number coercion. Confirmed via direct
   curl: `?family=Woody&page=2&sort=price-asc` now correctly returns 43
   total (matching the family's real facet count), 19 items on page 2
   (24+19=43 ✓), page 2 marked active, and prices genuinely ascending.

`sillage-api` deployed (Version `114ffe77`) and smoke-tested live —
`GET /v1/products?limit=2` returns `total: 354`, `GET /v1/products/facets`
returns 43 families / 35 brands. Both repos typecheck and build clean.
Website repo not yet committed/deployed as of this record.
