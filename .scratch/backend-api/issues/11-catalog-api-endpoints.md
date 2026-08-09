# Build sillage-api's product list/search/filter/facets/detail endpoints

Type: task
Status: resolved
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

**Shipped**: `src/routes/products.ts` in `sillage-api`, mounted at
`/v1/products`.

- `GET /v1/products` — `search` (ILIKE across name/brand/notes), `family`
  (repeatable, `IN`), `brand` (repeatable, `IN`), `priceMin`/`priceMax`,
  `sort` (`recommended`/`price-asc`/`price-desc`/`name`), `page`, `limit`
  (capped at 100). Returns `{ items, page, limit, total, totalPages }`.
- `GET /v1/products/facets` — same filter params; returns family/brand
  counts, each computed with every *other* filter applied but not the
  facet being counted itself (two separate `GROUP BY` queries via a shared
  `buildWhere(filters, { excludeFamily/excludeBrand })` helper).
- `GET /v1/products/:slug` — full detail shape.
- `GET /v1/products/:slug/variants` — matches the shape already built in
  the website repo's (now-to-be-deleted) `getProductVariantsBySlug`.
- `GET /v1/products/related/:slug?limit=4` — same-family products
  excluding the current one, ordered by rating. (Route path chosen as
  `/related/:slug` rather than `/:slug/related` — no real reason beyond
  keeping it visually distinct from `/:slug/variants`; either would work.)
- `GET /v1/products/home-collections` — arrivals/best-sellers, ported
  verbatim from the website repo's existing in-memory logic (fetch all
  active products once, sort/slice/exclude in JS) rather than rewritten as
  SQL — the table is small (~354 rows) and this exactly preserves existing
  behavior rather than risking a subtly different result from a "cleaner"
  SQL rewrite.

**Route ordering note**: `/facets`, `/home-collections`, and `/related/:slug`
are registered alongside `/:slug` and `/:slug/variants` on the same Hono
instance — verified locally that Hono's router correctly prioritizes the
static-segment routes over the `:slug` param route (no collision), rather
than assuming this and finding out via a production bug.

**Verified locally** against the real seeded local Postgres (Docker),
covering every endpoint: list (default + search + family filter + price
range + each sort), facets, detail, variants, related (confirmed the
results are genuinely same-family, not just plausible-looking), and
home-collections. One result that looked wrong at first — a price-range
query returning zero results — was confirmed correct by checking the raw
data (genuinely zero products in that range), not a bug.

**Not yet deployed** — `sillage-api` changes are usually deployed
independently (additive, non-breaking), but held here since tickets 12-14
haven't wired any frontend consumer to these routes yet; deploying now
would just be dead code live in production. Will deploy once at least one
consumer exists.
