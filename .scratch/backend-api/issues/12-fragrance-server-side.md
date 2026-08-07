# Move /fragrance to server-side filtering and pagination

Type: task
Status: open
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

_(pending)_
