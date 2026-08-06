# Decide the accounts/auth model

Type: grilling
Status: resolved
Blocked by: 01

## Question

`src/routes/account.tsx` and `src/platform/user/*` currently assume a Shopify Customer Accounts API shape (`useUser`, `useSignOut`) that has nothing behind it. With a real `customers` table (from [Design the Postgres schema](01-schema-design.md)), decide the actual auth mechanism: how a visitor signs up/signs in (email+password vs. magic link vs. something simpler for a hackathon), how the session is carried (cookie set by a `createServerFn`, what it stores/signs), and how a signed-in customer's identity attaches to their cart/orders/wishlist/addresses. Keep it proportionate to a hackathon demo — don't over-build.

## Answer

**Draft — for review.**

Use **[Better Auth](https://www.better-auth.com/)** rather than hand-rolled password hashing/session management. Rationale for picking a framework over the original from-scratch plan (email+password + Web Crypto PBKDF2 + a hand-built `sessions` table):

- It runs on Cloudflare Workers with no Node native bindings required (the original plan's whole reason for avoiding bcrypt in favor of hand-rolled Web Crypto PBKDF2 — Better Auth solves the same constraint as a maintained dependency instead of bespoke crypto code).
- First-class Drizzle adapter — generates/owns its own tables (`user`, `session`, `account`, `verification` by default) via its CLI, on top of our existing `drizzle-orm/pg-core` setup.
- Documented TanStack Start integration, matching this repo's stack exactly.
- Email+password support built in (with hashing, session cookies, sign-out) — this alone replaces essentially everything in the original draft.
- Ruled out alternatives: **Auth.js/NextAuth** (Drizzle adapter exists but Workers-edge support is spottier, more Next.js-shaped); **Lucia** (deprecated as of 2025, maintainers now recommend rolling your own — the thing we're trying to avoid); **Clerk/WorkOS** (hosted third-party account, external API keys — disproportionate for a hackathon demo).

Decisions carried over from the original draft (unaffected by the framework swap):

1. **Sign-up/sign-in mechanism: email + password only.** No magic links, no OAuth, no email verification — configure Better Auth's email/password provider with verification disabled.
2. **Session cookie**, not JWT — Better Auth's default session strategy is a DB-backed cookie session, which is what we wanted anyway.
3. **Naming collision with the existing guest-cart cookie.** `carts.session_token` (ticket 01, decision #4) identifies an anonymous cart — a different concept from Better Auth's own session cookie. Keep the cart's cookie name as `cart_session` so it never collides with whatever cookie name Better Auth uses for its session.
4. **Attaching identity to cart/orders/wishlist/addresses** (unchanged from the original draft):
   - **Cart** — on successful sign-in/sign-up, read the existing `cart_session` cookie, look up that `carts` row, and set its `customer_id` to Better Auth's user id (attach-only, no merge — ticket 01 #4).
   - **Orders** — use the authenticated user's id when signed in; fall back to `guest_email` when not (ticket 01 #7).
   - **Wishlist** — requires an authenticated session (ticket 01 #5, not-null `customer_id`); unauthenticated visitors get redirected to sign-in.
   - **Addresses** — same guard as wishlist (`addresses.customer_id` not-null).
5. **Explicitly out of scope**: password reset flow, rate-limiting on sign-in, multi-device session management UI — Better Auth supports plugins for some of these later if needed, but none are wired up for the hackathon demo.

**Open question for ticket 07 to resolve during implementation**: whether our existing `customers` table becomes Better Auth's `user` table (via its Drizzle schema generation/customization options) or stays separate with a `customer_id`/Better-Auth-`user.id` mapping column. Better Auth's Drizzle adapter supports customizing table/column names, so folding `customers` into its schema (keeping `given_name`/`family_name`) is likely possible and avoids duplicate identity tables — but that's an implementation detail to confirm against the actual library docs, not a design blocker.
