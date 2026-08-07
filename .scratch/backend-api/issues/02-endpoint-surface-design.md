# Design the endpoint surface: routes, methods, and payload shapes per domain

Type: grilling
Status: resolved
Blocked by: 01

## Question

For each domain in scope (per [Decide how this API relates to the existing
createServerFn actions and ticket 07](01-relationship-to-server-fn.md)'s
answer — catalog, cart, account/auth, wishlist, address, orders, or a subset),
design the concrete HTTP surface: URL paths under `/api/*`, HTTP methods,
request body shape, response body shape, and status codes for success and
each failure mode. Ground each route in the existing Postgres schema
(`src/db/schema.ts`, see [Design the Postgres schema for catalog + commerce](../../postgres-backend/issues/01-schema-design.md))
and, where a `createServerFn` equivalent already exists, its current input/output
shape (e.g. `Person` in `src/platform/user/user.types.ts`) so the HTTP contract
isn't inventing a new data model.

## Answer

**Convention decisions**: nested RESTful resources (not flat action-style
routes), field names renamed to match the schema (`variantId` not
`merchandiseId`, `itemId` not `lineId`), `productGroupID` dropped from the
wishlist contract (vestigial — read from `AnalyticsItem.item_group_id`,
consumed by nothing server-side since the schema has no product-group
concept), wishlist add/remove split into explicit `POST`/`DELETE` routes
rather than a single toggle endpoint.

All routes live in `sillage-api` (per ticket 01's amendment), authenticated
via `Authorization: Bearer <token>` (validated against the shared `session`
table) where a domain requires it.

### Cart (`/cart`)

Identity: bearer token when signed in; otherwise an `X-Cart-Session` header
holding an opaque cart session id. A request with neither gets a cart
created server-side, whose session id comes back in the response body for
the client to store (e.g. `localStorage`) and echo on subsequent calls.

- `GET /cart` → `{ id, sessionToken, items: [{ itemId, variantId, productId, title, size, image?, price: {amount,currencyCode}, quantity }], subtotal, total, totalQuantity }`. `total` equals `subtotal` for now — no discounts/shipping/tax exist yet. No `checkoutUrl` field — checkout is `POST /orders`, not a redirect.
- `POST /cart/items { variantId, quantity? }` → upsert (existing variant bumps quantity per the schema's `unique(cartId, variantId)`), returns the full cart.
- `PATCH /cart/items/:itemId { quantity }` → returns the full cart.
- `DELETE /cart/items/:itemId` → returns the full cart.

### Wishlist (`/wishlist`)

Reads are ungated (200 with an empty list for guests — matches
`WishlistButton` calling `useWishlist` unconditionally on every product
card); mutations require a valid bearer token (401 without one).

- `GET /wishlist` → `{ productIds: string[] }`
- `POST /wishlist/:productId` → add, returns `{ productIds }`
- `DELETE /wishlist/:productId` → remove, returns `{ productIds }`

### Addresses (`/addresses`)

Always requires a bearer token — the only consumer, `AddressBook.tsx`, only
renders behind `account.tsx`'s own `isAuthenticated` gate, so there's no
guest-read case to handle here unlike wishlist.

- `GET /addresses` → `{ addresses: Address[] }`
- `POST /addresses` → create, `{ addresses }`
- `PATCH /addresses/:id` → edit, `{ addresses }`
- `DELETE /addresses/:id` → `{ addresses }`
- `POST /addresses/:id/default` → set default, enforcing the single-default invariant server-side, `{ addresses }`

### Orders (`/orders`)

Checkout only — no list/history endpoint in this pass (no order-history UI
exists to consume one; deferred to fog).

- `POST /orders { addressId } | { shippingRecipient, shippingStreetAddress, shippingAddressLocality?, shippingAddressRegion?, shippingPostalCode, shippingAddressCountry? }, guestEmail?` —
  resolves the caller's current cart (bearer token or `X-Cart-Session`),
  rejects an empty cart (400), validates each line's `productVariants.stock`
  covers the requested quantity (400, naming the offending variant, if not)
  and decrements stock on success, snapshots `titleSnapshot`/`sizeSnapshot`/
  `unitPriceSnapshot` per the schema's existing snapshot design, creates the
  order with `status: "placed"`, clears the cart, and returns the full
  created order (201). Guests must supply `guestEmail` (matches the schema's
  nullable `customerId` + `guestEmail` guest-checkout design); signed-in
  users may reference a saved address by id instead of repeating fields
  (looked up from their own `addresses`, 404 if not found/not theirs).

This fully specifies the four domains' surface. [Decide the shared HTTP
contract conventions](03-contract-conventions.md) still owns the
cross-cutting pieces not decided here: versioning prefix, the JSON
success/error envelope shape, and exact status-code conventions (this ticket
used 200/201/400/401/404 informally above, but didn't fix an error-body
shape).
