# Migrate PDP/home-collections reads and remove the old catalog createServerFn surface

Type: task
Status: open
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

_(pending)_
