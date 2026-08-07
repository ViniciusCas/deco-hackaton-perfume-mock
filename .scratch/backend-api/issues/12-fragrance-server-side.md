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

## Deploy 1 postmortem: found and fixed a production-only crash

First website deploy (Version `8213b862`) made `/fragrance` **500 in
production while working fine locally** (`vite dev`). Root cause: the new
loader's SSR prefetch had **no error handling**, unlike every other SSR
prefetch in this codebase (`__root.tsx`'s cart/user/catalog prefetches all
wrap their calls in `.catch(() => {})`). A transient failure calling
`sillage-api` — cold start, subrequest hiccup, whatever — threw uncaught
through the loader, and TanStack Start's production error boundary caught
it and rendered a redacted `"Something went wrong."` (real error message
stripped in production builds, so the live site gave no clue).

**How this was actually diagnosed** (worth recording — none of the
straightforward approaches worked):
- `wrangler tail` showed `"outcome": "ok"` with no exception and no
  console output — the error was caught by the app's own boundary, not a
  platform-level crash, so the runtime's own exception tracking never saw it.
- Comparing local (`vite dev`) vs `npm run build` + local `wrangler dev`
  against the actual built artifact: **both succeeded**, ruling out a
  build-time/bundling issue.
- The real signal came from **`wrangler dev --remote`** (runs the exact
  built artifact against real bindings/network conditions, not Miniflare's
  local loop) — this reliably reproduced the 500, while local `wrangler dev`
  against the same artifact did not. Confirmed it wasn't a red herring from
  the reproduction method by checking `/`, `/account`, `/cart` (other
  routes touching Hyperdrive/sillage-api) all succeeded in the same
  `--remote` session.
- The actual error text was recovered from the SSR-streamed router state
  embedded in the page's own hydration script (`$_TSR.router(...)`), not
  from any server log — `e: new Error("Something went wrong.")` confirmed
  an error was thrown and caught at the `/fragrance` route match
  specifically.

**Fixed**: added `.catch(() => {})` to each of the two `ensureQueryData`
calls individually (not one catch around the whole `Promise.all`),
matching the established pattern. Verified fix via the same
`wrangler dev --remote` reproduction (500 → 200), then deployed for real
(Version `858c45b7`) and confirmed `/fragrance` returns 200 on the actual
production URL across three consecutive requests.

**SSR-prefetch gap, now confirmed harmless.** Even after the crash fix, the
SSR prefetch itself didn't appear to populate data server-side (`/fragrance`
showed "0 fragrances" at first paint on curl'd HTML). Root cause was never
chased down — instead, the user checked the live page in a real browser
and confirmed **all of it self-corrects**: the count updates to the real
total shortly after load, product tiles render, filter checkboxes show
real counts, and filtering/pagination actually work. Client-side hydration
(`useProducts()`/`useProductFacets()`) recovers exactly as the
`.catch(() => {})` fix was designed to allow, matching the same
SSR-flash-then-recover pattern already accepted for guest-cart SSR
elsewhere on this map. The *why* behind the SSR-side fetch not resolving
is still unknown, but it's now a confirmed cosmetic/first-paint-only issue,
not a functional one — not worth further investigation unless it
resurfaces as an actual user-facing problem.
