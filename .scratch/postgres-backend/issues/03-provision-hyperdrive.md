# Provision Cloudflare Hyperdrive for the RDS instance

Type: task
Status: resolved
Blocked by: (none)

## Question

The app deploys to Cloudflare Workers, which can't hold a direct long-lived TCP connection to RDS. Provision a Cloudflare Hyperdrive configuration pointed at `sillage-hackaton-db.cgnkm2gganse.us-east-1.rds.amazonaws.com` (Postgres, port 5432), wire its binding into `wrangler.jsonc`, and verify a Worker can actually query through it. This needs the RDS master password and Cloudflare account access — human-driven (HITL): the agent can prepare the exact `wrangler` commands / dashboard steps, but the user runs them.

Also confirms/decides: does local dev (`npm run dev`) connect through Hyperdrive's local-dev proxying, or does it need its own local connection string — feeds the map's "local dev DB story" fog.

## Answer

Worked live with the user (HITL — needed their RDS master password). Hyperdrive config `sillage-hyperdrive` created (id `5ffc8bf2c071488eab04135667fce6f3`), binding `HYPERDRIVE` auto-wired into `wrangler.jsonc` by `wrangler hyperdrive create` itself.

**Blockers hit and resolved:**
1. Security group on `sillage-hackaton-db` had to be widened to `0.0.0.0/0` on port 5432 — Hyperdrive doesn't publish a fixed egress IP range, so "my IP only" doesn't work (already open by the time we got here).
2. First `wrangler hyperdrive create` attempt failed with "Invalid database credentials [code: 2013]" — turned out to be user error working out how to build the connection string; resolved once the exact `postgres://user:password@host:port/db` string was used correctly.
3. **Real end-to-end query verification required a genuine debugging loop**, not just wiring: a throwaway `/hyperdrive-test` route (deleted after) using `postgres.js` against `cloudflare:workers`'s `env.HYPERDRIVE` kept failing with `write CONNECT_TIMEOUT <uuid>.hyperdrive.local:5432`. Root causes, in the order found:
   - `postgres.js` defaults to server-side prepared statements, which Hyperdrive's pooling doesn't support — silently hangs instead of erroring. Fix: `prepare: false` (plus `fetch_types: false`, Cloudflare's other standard recommendation).
   - Even with that fix, **any explicit `ssl` option** (`"require"`, `"prefer"`, or `false`) made it hang in production too — Hyperdrive terminates TLS to RDS itself and doesn't expect the Worker side to negotiate SSL at all. Fix: **omit the `ssl` key from the `postgres()` options entirely** (not `false` — actually absent).
   - Verified working via a real deployed Worker (`https://sillage.sillage-hackaton.workers.dev/hyperdrive-test` returned `{"ok":true,"rows":[{"ok":1,"ts":"..."}]}`), since production Hyperdrive is the authoritative path.
4. **Local dev (`vite dev`/`wrangler dev`) is a separate, unresolved limitation**, not fixed by the above:
   - `applyHyperdriveEnvVars` in wrangler reads the local connection string from `process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` directly — **not** from `.dev.vars` (that's loaded later, for other bindings). Workflow: `set -a; source .dev.vars; set +a; npm run dev` (`.dev.vars` happens to be valid shell syntax). `.dev.vars` is gitignored, holds the real RDS connection string for local dev, never committed.
   - Locally, the Hyperdrive binding's `connectionString` connects **directly** to RDS (bypassing Hyperdrive's real TLS-terminating proxy) — so unlike production, it genuinely needs real SSL. But requesting SSL locally (any explicit mode) hangs with the same `CONNECT_TIMEOUT` against Miniflare's `.hyperdrive.local` socket layer — a distinct bug from the production one, in the local workerd/Miniflare socket simulation itself. Omitting SSL locally instead fails fast and correctly with `no pg_hba.conf entry for host "<real IP>" ... no encryption`, confirming the direct-connection theory but not resolving it.
   - **Net effect**: local dev DB queries against the real RDS instance don't currently work end-to-end. Options for ticket 04/07 to pick up: (a) live with it and always test DB-touching routes via a deploy, (b) run a local/dockerized Postgres for dev and point `.dev.vars`'s local connection string at that instead of RDS, (c) revisit if a wrangler/vite-plugin update fixes the local SSL relay. Not resolved here — flagged as the map's standing "local dev DB story" fog.

**Final working config** (for ticket 04 to carry forward): `postgres(env.HYPERDRIVE.connectionString, { max: 5, fetch_types: false, prepare: false })` — no `ssl` key — in production. `npm install postgres` was tested (not saved to `package.json` — that's ticket 04's scope) as the client library; nothing here mandates Drizzle use a different driver, `postgres.js` is Drizzle's standard `drizzle-orm/postgres-js` driver anyway.
