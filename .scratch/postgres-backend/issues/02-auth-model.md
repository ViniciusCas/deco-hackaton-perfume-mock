# Decide the accounts/auth model

Type: grilling
Status: resolved
Blocked by: 01

## Question

`src/routes/account.tsx` and `src/platform/user/*` currently assume a Shopify Customer Accounts API shape (`useUser`, `useSignOut`) that has nothing behind it. With a real `customers` table (from [Design the Postgres schema](01-schema-design.md)), decide the actual auth mechanism: how a visitor signs up/signs in (email+password vs. magic link vs. something simpler for a hackathon), how the session is carried (cookie set by a `createServerFn`, what it stores/signs), and how a signed-in customer's identity attaches to their cart/orders/wishlist/addresses. Keep it proportionate to a hackathon demo — don't over-build.

## Answer

**Implemented.**

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

**Resolution of the open schema question**: the hand-rolled `customers` table (ticket 01) was dropped entirely and replaced by Better Auth's own `user`/`session`/`account`/`verification` tables in `src/db/schema.ts` — no duplicate identity table. `user` carries `given_name`/`family_name` as additional fields (Better Auth's `user.additionalFields` config in `src/db/auth.ts`) alongside its own required `name`. Every FK that pointed at `customers.id` (`addresses.customer_id`, `carts.customer_id`, `wishlist_items.customer_id`, `orders.customer_id`) now points at `user.id` — and changed type from `uuid` to `text`, since Better Auth's default id generator produces string ids, not uuids.

**What shipped**:
- `src/db/schema.ts` — `user`, `session`, `account`, `verification` tables (Better Auth's shape, hand-written rather than CLI-generated since the CLI's introspection needs the same TTY-prompt workaround as `drizzle-kit generate` did — see ticket 04).
- `src/db/auth.ts` — `getAuth()`, built fresh per request (same constraint as `getDb()`: the Hyperdrive binding only exists inside a request's execution context, so this can't be a module-level singleton). `baseURL` derived from the incoming request (no fixed canonical host — deployed on workers.dev/preview subdomains). `session.disableSessionRefresh: true` implements the "no sliding renewal" decision (a raw `updateAge: 0` does the *opposite* — verified against Better Auth's refresh-threshold formula, it means "always refresh").
- `src/platform/user/user.actions.ts` — `getUserServerFn`/`signInServerFn`/`signUpServerFn`/`signOutServerFn` rewritten against `auth.api.getSession`/`signInEmail`/`signUpEmail`/`signOut`, keeping the exact same exported function names and `Person` shape so `user.hooks.ts`, `login.tsx`, and `account.tsx` needed no changes to their hook surface (`useUser`, `useSignIn`, `useSignUp`, `useSignOut`). Better Auth's server API doesn't run inside an HTTP handler when called this way, so it can't set cookies itself — `forwardSetCookie()` pulls its `Set-Cookie` header(s) via `returnHeaders: true` and re-applies them through TanStack Start's `setResponseHeader`.
- Password reset dropped per the "explicitly out of scope" line above: removed `recoverPasswordServerFn`/`useRecoverPassword` and the recover view from `login.tsx` (was a working stub against Shopify's recover mutation; no equivalent wired up here).
- Signup password minimum raised from 5 to 8 characters in `login.tsx` to match Better Auth's default `minPasswordLength`.
- Verified end-to-end against the local Postgres container (sign-up persists a real row with `given_name`/`family_name`, session cookie round-trips through `getSession`, sign-in works, wrong password is rejected with a clean error message) via a throwaway script exercising the same schema/adapter config, plus `/login` and `/account` rendering correctly through the real dev server.

Cart/wishlist/address are still on the unconnected Shopify-shaped plumbing — wiring signed-in identity into them is ticket 07's job, not done here.
