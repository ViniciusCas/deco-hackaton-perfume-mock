# Decide how SSR forwards a token to sillage-api, and fix bearer-token validation

Type: grilling
Status: resolved

## Question

Graduated from the map's fog: how does this repo's server-side rendering
(`__root.tsx`'s `beforeLoad` prefetch, and any other server-side code) call
`sillage-api` when the bearer token from Better Auth's bearer plugin only
ever reaches the **client** (via the `set-auth-token` response header on
sign-in/sign-up) — SSR runs before any client-side token exists in memory.

**A second, more urgent problem surfaced while researching this**, reading
Better Auth's actual source
(`node_modules/better-auth/dist/plugins/bearer/index.mjs` and
`node_modules/better-auth/dist/cookies/index.mjs`):

The token Better Auth's bearer plugin hands back via `set-auth-token` is
**not** the raw value stored in the `session.token` column — it's a
**signed cookie value**, format `<rawToken>.<hmacSignature>` (`ctx.setSignedCookie(...)`
at `cookies/index.mjs:127`, using `session.session.token` + `HMAC-SHA256`
over the app's `secret`). The bearer plugin's own inbound handling
(`bearer/index.mjs`, the `before` hook) expects exactly this format and
re-derives/verifies it before treating it as a session.

`sillage-api`'s already-shipped `src/middleware/auth.ts` (from
[ticket 05](05-scaffold-sillage-api.md)) does a **naive raw lookup** —
`eq(sessionTable.token, token)` against the whole incoming bearer string.
Since real tokens arrive as `<rawToken>.<signature>`, not bare `<rawToken>`,
**every bearer request will fail to authenticate against a real session in
practice** — this was untested against a live database (ticket 05 only
verified `tsc`/`wrangler --dry-run`), so the bug shipped silently.

Two things to decide:

1. **SSR forwarding mechanism.** Better Auth exports a public helper for
   exactly this — `getSessionCookie(request, { cookiePrefix })` from
   `better-auth/cookies` — which reads the raw signed cookie value directly
   off an incoming `Request`'s `Cookie` header, no secret needed. Since SSR
   already receives the browser's session cookie (same-origin, unlike
   `sillage-api`), it can call `getSessionCookie(request, { cookiePrefix: "sillage" })`
   and forward that value as `Authorization: Bearer <value>` to
   `sillage-api` directly — no new mechanism, no minting a token, no
   dependency on the client-held token at all for the SSR case. Confirm
   this is the intended approach (vs. something else).
2. **Fix `sillage-api`'s validation to match the real token format.** The
   incoming token is `<rawToken>.<signature>`; the DB lookup needs
   `<rawToken>`, not the whole string. Two ways to fix it:
   - **Strip only**: split on the last `.`, look up the DB by the raw part,
     ignore the signature. `sillage-api` needs no new secret. Security-wise
     this is fine on its own merits — `session.token` values are
     high-entropy random strings Better Auth generates, so the DB exact-match
     already is the real access gate; the signature exists to let Better
     Auth reject a tampered cookie *before* touching the DB, which doesn't
     change the actual security boundary here, just adds an extra check.
   - **Strip and verify**: also HMAC-verify the signature against
     `BETTER_AUTH_SECRET`, matching what Better Auth itself does. Requires
     syncing `BETTER_AUTH_SECRET` into `sillage-api` as a duplicate secret
     (`wrangler secret put` there, same value as the website repo's).
     Slightly more defense-in-depth (rejects a malformed/tampered token
     before hitting the DB) at the cost of a second copy of a real secret to
     manage and keep in sync if ever rotated.

## Answer

1. **SSR forwarding**: use Better Auth's own exported helper,
   `getSessionCookie(request, { cookiePrefix: "sillage" })` from
   `better-auth/cookies`, to read the raw signed session cookie value
   directly off the incoming SSR request — no secret needed, no new
   mechanism. Forward that value verbatim as `Authorization: Bearer <value>`
   on any server-side call this repo makes to `sillage-api`. Returns `null`
   for a guest/unauthenticated request — in that case, simply omit the
   `Authorization` header (matches `sillage-api`'s `attachUser` middleware,
   which never blocks on a missing header, only `requireUser`-gated routes
   do). No dependency on the client-held `set-auth-token` value for the SSR
   path at all; that value is only ever needed for genuine client-side
   (post-hydration) fetches straight from the browser to `sillage-api`.
2. **`sillage-api`'s bearer validation, fixed**: strip the trailing
   `.<signature>` (split on the last `.`, use the part before it) and look
   up `session.token` by that raw value — no HMAC verification, no new
   secret synced into `sillage-api`. The DB exact-match against a
   high-entropy random token is the real access boundary; signature
   verification would only reject a malformed token slightly earlier, not
   close an actual gap, and this keeps `sillage-api` free of a duplicated
   copy of `BETTER_AUTH_SECRET` to manage/rotate.

**Fixes required in already-shipped code** (from [ticket 05](05-scaffold-sillage-api.md),
now known broken — every bearer request would have 401'd against a real
session before this fix):
- `sillage-api/src/middleware/auth.ts` — strip the signature suffix before
  the DB lookup.
- New shared helper needed in the website repo (not written yet) wrapping
  `getSessionCookie` + the `fetch(...)` call to `sillage-api`, so every SSR
  call site (root route prefetch, and any `createServerFn` that needs to
  reach `sillage-api` server-side) uses it consistently rather than each
  hand-rolling the cookie read.

**New fog surfaced, not resolved here**: guest cart identity during SSR.
Guests get their cart-session id from `sillage-api`'s response body on their
*first client-side write* (per [ticket 02](02-endpoint-surface-design.md)) —
stored in `localStorage`, which SSR has no access to. A guest's very first
page load therefore has no `X-Cart-Session` to forward, meaning the root
route's SSR cart prefetch can't produce a real cart for a first-time guest
regardless of the auth fix above. Left as fog on the map — the likely answer
is "SSR renders an empty cart placeholder for guests, the client fetches the
real one after hydration once a cart-session id exists," but that's a
decision for whoever picks up the actual frontend cutover, not settled here.
