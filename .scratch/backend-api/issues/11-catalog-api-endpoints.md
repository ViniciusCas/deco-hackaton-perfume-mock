# Build sillage-api's product list/search/filter/facets/detail endpoints

Type: task
Status: open
Blocked by: 10

## Question

Per [ticket 10](10-catalog-migration.md)'s answer, build the actual
`sillage-api` routes against its existing (duplicated, currently-unused)
`products`/`productVariants` schema tables:

- `GET /v1/products` — `search` (name/brand/notes text match), `family[]`,
  `brand[]`, `priceMin`/`priceMax`, `sort` (recommended/price-asc/
  price-desc/name — mirroring `fragrance.tsx`'s existing `SORTS`), `page`,
  `limit`. Lean shape (matches current `CatalogEntry` minus PDP-only
  fields). Also the backing call for the header searchbar's debounced
  search (same endpoint, `search` param, small `limit`) and PDP's related-
  products rail (`family` param, `limit=4`, excluding current slug).
- `GET /v1/products/facets` — same filter params as the list endpoint
  (minus the facet being counted), returns family/brand counts reflecting
  every *other* currently-applied filter. Two aggregate queries (one
  excluding the family filter, one excluding the brand filter).
- `GET /v1/products/:slug` — full detail shape (adds description/votes/
  releaseYear/gender), matches current `getProductBySlug`.
- `GET /v1/products/:slug/variants` — matches current
  `getProductVariantsBySlug`.
- `GET /v1/products/home-collections` — arrivals (4 newest by release
  year) + best sellers (4 by votes, excluding arrivals), matches current
  `getHomeCollections` logic exactly.

All under the `/v1` prefix, `{ data }`/`{ error }` envelope, per
[ticket 03](03-contract-conventions.md)'s conventions. No auth needed —
catalog is fully public.

## Answer

_(pending)_
