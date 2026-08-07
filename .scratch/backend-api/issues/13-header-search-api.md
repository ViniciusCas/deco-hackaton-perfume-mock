# Move header search to debounced API calls

Type: task
Status: open
Blocked by: 11

## Question

Rework the header `Searchbar` component's live-suggestions behavior to
call `GET /v1/products?search=<query>&limit=<n>` (from
[ticket 11](11-catalog-api-endpoints.md)), debounced, instead of filtering
`useCatalog()`'s cached array as the user types. Decide the debounce
interval and result count (not yet specified — look at the current
client-side implementation for the existing UX baseline before choosing).

## Answer

_(pending)_
