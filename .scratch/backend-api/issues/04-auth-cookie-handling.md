# Decide auth/session handling for /api/* requests

Type: grilling
Status: closed (superseded — see [Decide how this API relates to the
  existing createServerFn actions and ticket 07](01-relationship-to-server-fn.md)'s
  amendment)

## Question

The site's current auth (Better Auth, `src/db/auth.ts`, cookie prefix
`sillage`) issues a session cookie consumed server-side inside `createServerFn`
handlers via `getRequest().headers`. Real HTTP routes under `/api/*` need the
same session read on incoming requests — confirm the cookie is readable the
same way from a `server.handlers` route (`request.headers` on the handler's
`request` arg) and decide whether mutating routes (POST/PUT/DELETE) need CSRF
protection given they're now reachable via plain `fetch` and not gated by
`createServerFn`'s same-origin RPC framing. Out of scope: any new API-key or
token scheme — per charting, the only consumer is the same-origin website, so
cookie-based session auth is assumed sufficient unless this ticket finds a gap.

## Answer

**Superseded.** This ticket's premise — the API reading Better Auth's
session *cookie* — no longer applies. The amendment to
[Decide how this API relates to the existing createServerFn actions and
ticket 07](01-relationship-to-server-fn.md) settled cross-origin auth as a
**bearer token** (Better Auth's bearer plugin, validated in the new
`sillage-api` repo by a direct `session`-table lookup, not a cookie read) —
this ticket's specific questions (cookie readability from a route handler,
CSRF on cookie-driven mutations) are moot once there's no cookie in the
cross-repo path.

One real question the amendment surfaced but didn't resolve: **how does
this repo's server-side rendering (e.g. `__root.tsx`'s `beforeLoad`
prefetch, which runs during SSR before any client-held bearer token exists)
fetch cart data from `sillage-api`?** The bearer token lives in browser
memory after sign-in — it isn't available to a server-side request made
during the initial page render. Not ticketed yet — logged as fog on the map,
since it's not clear whether the answer is "SSR skips the cart prefetch and
the client fetches it after hydration" or something that needs its own
token-passing mechanism, and that's worth its own focused decision rather
than folding into this closed ticket.
