# Migrate catalog reads to sillage-api

Type: grilling
Status: resolved

## Question

Graduated from the map's fog ("Migrating catalog and account/auth from
`createServerFn` to `sillage-api`... deliberately deferred") — narrowed to
**catalog only** per the request that prompted this ticket ("perfumes
should be handled via API calls, not rendered directly from the frontend").
Account/auth stays out of scope, per ticket 01's original reasoning
(unchanged, more sensitive/coupled to Better Auth living in this repo).

Current surface, all in `src/platform/catalog/catalog.actions.ts` /
`src/db/queries.ts`, all `createServerFn`-wrapped direct DB reads:
- `getCatalogServerFn` — full active-product list (lean shape)
- `getHomeCollectionsServerFn` — arrivals (4 newest) + best sellers (4 by votes)
- `getProductBySlugServerFn` — single product, full detail shape (adds
  description/votes/releaseYear/gender on top of the lean shape)
- `getProductVariantsBySlugServerFn` — variants (id/size/price/stock) for a
  product, added recently for the cart cutover

`sillage-api` already has `products`/`productVariants` in its duplicated
schema copy (unused so far — cart/wishlist/address/orders reference them by
id but never read/list them directly).

Open questions:
1. **Replace or keep both?** Ticket 01's precedent for cart/wishlist/
   address/orders was full replace, no dual RPC+HTTP surface. Same here?
2. **SSR prefetch mechanism.** Catalog reads are public (no auth), unlike
   cart — does that change anything about how `__root.tsx`'s `beforeLoad`
   fetches it, versus the `createServerFn`-wrapping pattern ticket 09 had to
   use for cart (`getRequest()` can't be called directly in `beforeLoad`)?
3. **Route/shape mapping**: what do the four functions above become as
   `/v1/*` routes on `sillage-api`, and do they keep the same lean-vs-detail
   shape split `getProductBySlug` already has?
4. **Pagination** — deferred as fog for the whole map originally ("none of
   the four domains need it yet"). Catalog is ~354 products; is a real,
   versioned `/v1/products` list endpoint the moment to add it, or still
   not needed?

## Answer

**Scope grew substantially during grilling** — this started as "swap 4
`createServerFn`s for 4 HTTP routes" and turned out to require reworking
how `/fragrance` and the header search actually work, once "server-side,
not client-cached" was followed through consistently. Recorded here in
full; split into separate implementation tickets below since this is well
beyond one session's build (see [Fog of war](#ticket-types) sizing note).

1. **Full replace.** `catalog.actions.ts` and `src/db/queries.ts`'s DB
   access get deleted; the frontend calls `sillage-api` directly for
   everything catalog-related, matching cart/wishlist/address/orders.
2. **SSR prefetch**: a thin `createServerFn` wrapper per read (matching
   `getCartSsrServerFn`'s pattern from ticket 09) — required by the same
   production-build constraint (`getRequest`/`fetch` can't be called
   directly in `beforeLoad`), even though catalog needs no auth/cookie
   forwarding.
3. **Shape split kept**: lean list shape vs. full detail shape (`:slug`
   route), matching what `getProductBySlug` already does.
4. **Real server-side pagination AND filtering.** `GET /v1/products`
   accepts `search`, `family[]`, `brand[]`, `priceMin`/`priceMax`, `sort`,
   `page`, `limit` — the actual query params `/fragrance`'s filter drawer
   and the header searchbar need, executed as real Postgres queries in
   `sillage-api`, not client-side array filtering.
5. **Facet counts are live**, recalculated per currently-applied filters —
   standard faceted-search semantics: each facet's count reflects what
   selecting it would yield given every *other* currently-applied filter.
   This needs `sillage-api` to expose a facet/aggregate endpoint alongside
   the list endpoint, not just the list itself.
6. **Header searchbar moves to debounced API calls** against the same
   search-capable list endpoint — no more filtering a client-cached array
   for live suggestions either.
7. **PDP "related products"**: same-family lookup via the new filtered
   endpoint (`?family=<entry.family>&limit=4`, excluding the current
   product) — actually related, not arbitrary, and reuses the endpoint
   being built anyway rather than a separate mechanism.

**What this touches**, concretely:
- `sillage-api`: new `/v1/products` (list, search, filter, sort, paginate),
  a facets/aggregate endpoint, `/v1/products/:slug` (detail),
  `/v1/products/:slug/variants`, `/v1/products/home-collections`.
- This repo: `src/routes/fragrance.tsx` (client-side filter/sort/pagination
  state → query-string-driven server calls), `Header`'s `Searchbar`
  (debounced live search), `$.tsx` (related products via the new
  family-filtered call instead of `catalog.filter(...)`), `src/platform/
  catalog/*` (replaced with `sillage-api`-backed hooks), `__root.tsx`
  (SSR prefetch wrapper), deletion of `src/db/queries.ts` and
  `catalog.actions.ts`.

## Follow-up tickets (implementation, not further decisions)

Split by natural boundary — each is independently buildable/deployable
once its prerequisite lands:

- [Build sillage-api's product list/search/filter/facets/detail endpoints](11-catalog-api-endpoints.md)
- [Move /fragrance to server-side filtering and pagination](12-fragrance-server-side.md)
- [Move header search to debounced API calls](13-header-search-api.md)
- [Migrate PDP/home-collections reads and remove the old catalog createServerFn surface](14-catalog-cutover-remaining.md)
