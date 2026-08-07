# Cut over cart/account/wishlist off the Shopify plumbing

Type: task
Status: closed (superseded — out of scope)
Blocked by: 01, 02, 04

## Question

Replace `src/platform/cart/cart.actions.ts`, `src/platform/user/user.actions.ts`, `src/platform/wishlist/*`, and `src/platform/address/*`'s calls into `@decocms/apps-shopify` with `createServerFn`s that read/write the Postgres tables from [Design the Postgres schema](01-schema-design.md), using the session/auth mechanism from [Decide the accounts/auth model](02-auth-model.md). Keep the existing hook surface (`useCart`, `useAddToCart`, `useUser`, `useSignOut`, wishlist hooks, `AddressBook`) working from the component side — this is a backend swap behind the same frontend contracts, not a UI rewrite. Decide (per the map's fog) whether the Shopify-shaped types are deleted or kept as a compatibility layer during the swap. Also produces the "order" flow: turning a cart into a persisted order.

## Answer

**Superseded — closed out of scope, not resolved on this map.** A sibling
map, [A real HTTP backend API for the storefront](../../backend-api/map.md),
charted after this ticket sat open, decided in
[its first ticket](../../backend-api/issues/01-relationship-to-server-fn.md)
that cart/wishlist/address (plus orders) get built directly as real HTTP
routes (`/api/*`) backed by Postgres, replacing `createServerFn` as the
storefront's backend rather than adding it as an intermediate step. That
supersedes this ticket's job entirely — the same wiring happens, just as HTTP
route handlers instead of `createServerFn` actions. See that map's Decisions
so far for the actual work as it lands.
