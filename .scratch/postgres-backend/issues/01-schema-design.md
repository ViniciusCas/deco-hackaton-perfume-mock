# Design the Postgres schema for catalog + commerce

Type: grilling
Status: resolved
Blocked by: (none)

## Question

Design the full table set this storefront needs in Postgres, as Drizzle schema definitions:

- **Catalog**: a `products` table (or `perfumes`) covering `RawPerfume`'s source columns (`id, name, brand, release_year, gender, accords, notes_top, notes_middle, notes_base, rating, votes, description, image_url`) — decide which of `CatalogEntry`'s derived fields (`slug, family, notes, mood, price, tag`) become real stored/indexed columns vs. computed at query time (e.g. `slug` almost certainly wants to be a real unique indexed column; `price` is currently a deterministic function of rating/votes — decide if it stays computed-on-write or becomes a real editable price column now that there's a real DB).
- **Cart**: `carts` + `cart_items` (or equivalent), replacing `src/platform/cart/cart.types.ts`'s `CartState`/`CartItem` shape — decide identity (session-based guest cart vs. user-attached cart, and how a cart persists across visits without an account).
- **Customers/accounts**: a `customers` table replacing the Shopify customer shape assumed by `src/platform/user/user.types.ts` and `useUser`/`useSignOut`.
- **Wishlist**: table backing `src/platform/wishlist/wishlist.hooks.ts`.
- **Addresses**: table backing `src/platform/address/address.types.ts` (`AddressBook` component).
- **Orders**: `orders` + `order_items`, capturing what a completed cart becomes (see map's "Not yet specified" on checkout scope — assume "persist an order row," not real payment processing, unless this ticket's answer says otherwise).

Output: the actual Drizzle schema file(s) (or a clear written spec of tables/columns/relations/indexes) that later tickets implement against.

## Answer

Grilled across three rounds, all recommendations accepted. Schema written to `src/db/schema.ts` (Drizzle, `drizzle-orm/pg-core` — not yet installed as a dependency, that's [Set up Drizzle ORM + drizzle-kit](04-drizzle-setup.md)'s job).

Decisions:
1. **Catalog price** — real, independently-editable column, seeded once from the existing rating/votes formula.
2. **Catalog derived fields** (`family`, `notes`, `mood`, `tag`, `slug`) — stored, indexed columns, computed once at seed time, not recomputed per-query.
3. **Product variants** — real `product_variants` table (`product_id`, `size`, `price`, `stock`), replacing the hardcoded 3-size UI list and unblocking a real "add to cart."
4. **Cart identity** — guest-first: `carts.customer_id` nullable, identified by a `session_token` cookie, optionally attached to a customer on sign-in.
5. **Wishlist** — account-only (`wishlist_items.customer_id` not null).
6. **Customers table scope** — identity fields only (email, given/family name); auth/session storage deferred to [Decide the accounts/auth model](02-auth-model.md).
7. **Guest checkout** — allowed; `orders.customer_id` nullable + `guest_email`.
8. **Order status** — minimal `order_status` enum: `placed`, `cancelled`. No payment-shaped states.
9. **Order line snapshots** — `order_items` freezes `title_snapshot`, `size_snapshot`, `unit_price_snapshot` at purchase time.
10. **Product images** — single `image_url` column, no separate images table.
11. **Product deletion** — soft delete via `products.is_active`; rows never hard-deleted so cart/order references never dangle.
12. **Repeat add-to-cart** — unique `(cart_id, variant_id)`; re-adding increments quantity rather than inserting a duplicate line.

Also decided by fact, not asked: primary keys are UUIDs throughout, with `products.id` specifically preserved from `perfumes.json`'s existing UUID `id` field rather than generated. Orders snapshot shipping-address fields directly (not an `addresses` FK) — a direct consequence of guest checkout (no address book) plus the snapshot decision (#9), not a separate fork.

Full table set: `products`, `product_variants`, `customers`, `addresses`, `carts`, `cart_items`, `wishlist_items`, `orders`, `order_items`, plus `order_status` enum. Drizzle `relations()` included for all FKs.
