# Cut over cart/account/wishlist off the Shopify plumbing

Type: task
Status: open
Blocked by: 01, 02, 04

## Question

Replace `src/platform/cart/cart.actions.ts`, `src/platform/user/user.actions.ts`, `src/platform/wishlist/*`, and `src/platform/address/*`'s calls into `@decocms/apps-shopify` with `createServerFn`s that read/write the Postgres tables from [Design the Postgres schema](01-schema-design.md), using the session/auth mechanism from [Decide the accounts/auth model](02-auth-model.md). Keep the existing hook surface (`useCart`, `useAddToCart`, `useUser`, `useSignOut`, wishlist hooks, `AddressBook`) working from the component side — this is a backend swap behind the same frontend contracts, not a UI rewrite. Decide (per the map's fog) whether the Shopify-shaped types are deleted or kept as a compatibility layer during the swap. Also produces the "order" flow: turning a cart into a persisted order.

## Answer

_(pending)_
