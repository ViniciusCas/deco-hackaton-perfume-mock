# Move header search to debounced API calls

Type: task
Status: resolved
Blocked by: 11

## Question

Rework the header `Searchbar` component's live-suggestions behavior to
call `GET /v1/products?search=<query>&limit=<n>` (from
[ticket 11](11-catalog-api-endpoints.md)), debounced, instead of filtering
`useCatalog()`'s cached array as the user types. Decide the debounce
interval and result count (not yet specified — look at the current
client-side implementation for the existing UX baseline before choosing).

## Answer

**Debounce interval and result count kept identical to the existing
baseline** — 300ms (matching `/fragrance`'s own debounce from ticket 12,
for consistency across the app) and `MAX_SUGGESTIONS = 6` (unchanged from
the prior client-side implementation).

**Shipped**:
- `src/sdk/useDebouncedValue.ts` (new) — extracted the debounce-a-value
  hook out of `fragrance.tsx` (ticket 12 had it as a local, unexported
  function) into a shared location, since this ticket needed the exact
  same behavior. Distinct from the pre-existing `src/sdk/debounce.ts`,
  which debounces a *callback*, not a *value* — different shape, kept both.
- `useProducts` (`products.hooks.ts`) gained an `options: { enabled?: boolean }`
  second parameter — needed so the searchbar can skip the query entirely
  when the input is empty, rather than fetching (and briefly rendering) the
  default unfiltered product list as if it were "suggestions" for an empty
  search.
- `Searchbar/Form.tsx` — dropped the `useCatalog()` + local `.filter()`
  suggestion logic entirely; suggestions now come from `useProducts({ search, limit: 6 }, { enabled: query.length > 0 })`,
  debounced. The "Enter → navigate to `/fragrance?q=...`" behavior is
  unchanged (already always did a real navigation, not a client-side
  filter — no rework needed there).

**Verification note**: unlike [ticket 12](12-fragrance-server-side.md),
this component has **no SSR loader** — it's a plain client-side dropdown,
so the specific class of bug that caused `/fragrance`'s production crash
(an unhandled prefetch rejection thrown through a route loader) doesn't
apply here; `useProducts`'s own React Query error handling already
degrades to `isError`/empty results rather than throwing. Verified locally
that the homepage (which renders the header/searchbar) still returns 200
with no console errors after the change. **Not verified in a real
browser** — whether the dropdown actually populates/updates as expected
while typing wasn't clicked through, only inferred from `useProducts`
being the same already-proven-working mechanism used by `/fragrance`.
