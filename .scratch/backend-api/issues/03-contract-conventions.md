# Decide the shared HTTP contract conventions

Type: grilling
Status: resolved
Blocked by: 01

## Question

Before (or alongside) designing individual routes, fix the conventions that
apply across all of them: a versioning prefix or none (`/api/products` vs
`/api/v1/products`), a JSON success/error envelope shape (bare payload vs
`{ data }`/`{ error }` wrapper), how validation errors are reported (status
code + body shape), and pagination convention for list endpoints (catalog,
orders). Keep it consistent with existing response shapes already returned by
`createServerFn` actions where a domain is shared, so callers migrating from
RPC to HTTP see a familiar shape.

## Answer

- **Versioning**: `/v1` prefix from the start — `/v1/cart`, `/v1/wishlist`,
  `/v1/addresses`, `/v1/orders`.
- **Success envelope**: `{ data: <payload> }`, wrapping whatever [the
  endpoint design](02-endpoint-surface-design.md) already specified per
  route (e.g. `{ data: { productIds: [...] } }`, `{ data: <cart> }`,
  `{ data: <order> }`).
- **Error envelope**: `{ error: { code, message, details? } }` — `code` a
  short machine-readable string (`"insufficient_stock"`, `"unauthorized"`,
  `"not_found"`, `"empty_cart"`, etc.) the frontend branches on, `message`
  human-readable, `details` an optional freeform object for cases needing
  extra structure (e.g. insufficient stock naming the offending
  `variantId`/`requested`/`available`).
- **Status codes**: 200 for reads/updates, 201 for creates (`POST /v1/cart/items`,
  `POST /v1/addresses`, `POST /v1/orders`), 400 for validation/business-rule
  failures (empty cart, insufficient stock), 401 for a missing/invalid
  bearer token where one's required, 404 for not-found-or-not-the-caller's
  (e.g. an `addressId` that isn't theirs).
- **Pagination**: explicitly not specified — none of cart/wishlist/addresses/orders
  return lists large enough to need it in this pass (orders doesn't even
  have a list endpoint yet). Left out rather than designed prematurely;
  revisit if/when an order-history endpoint gets scoped.

This was the last open ticket on the map — the endpoint surface (ticket 02)
plus these conventions fully specify what `sillage-api` needs to implement
for cart/wishlist/addresses/orders.
