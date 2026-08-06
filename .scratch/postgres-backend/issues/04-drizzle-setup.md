# Set up Drizzle ORM + drizzle-kit in the repo

Type: task
Status: resolved
Blocked by: 01, 03

## Question

Scaffold Drizzle in the repo: install `drizzle-orm`/`drizzle-kit`, write the schema file(s) from [Design the Postgres schema](01-schema-design.md) as real Drizzle table definitions, configure `drizzle.config.ts` and a migration workflow (`drizzle-kit generate`/`migrate`), and add a DB client helper that reads the Hyperdrive binding from [Provision Cloudflare Hyperdrive](03-provision-hyperdrive.md) inside a `createServerFn` context. Add `package.json` scripts for generating/running migrations.

## Answer

Installed `drizzle-orm`, `postgres` (real save this time, unlike ticket 03's throwaway `--no-save`), and `drizzle-kit`/`dotenv` as dev deps. Added `db:generate`, `db:migrate`, `db:studio` scripts.

**`src/db/client.ts`**: `getDb()` reads `env.HYPERDRIVE` via `cloudflare:workers` and constructs a `drizzle(sql, { schema })` instance, carrying forward ticket 03's exact working config (`prepare: false`, `fetch_types: false`, no `ssl` key). Verified end-to-end against the real deployed Worker with a throwaway `/drizzle-test` route (deleted after): `{"ok":true,"count":0,"rows":[]}` — Drizzle itself works through Hyperdrive, not just raw `postgres.js`.

**`drizzle.config.ts`**: reads the connection string from `.dev.vars` (same RDS credentials ticket 03 set up), `dialect: "postgresql"`, `ssl: "require"` — this config is only used by the `drizzle-kit` CLI, which runs as a plain Node process directly against RDS (not through Hyperdrive), so it needs real SSL unlike the Worker-side client.

**`npm run db:generate` worked fine** — produced `drizzle/0000_yummy_mentallo.sql`, a clean 9-table migration matching the schema exactly.

**`npm run db:migrate` and `drizzle-kit push` do not work against this RDS instance** — both hang indefinitely on drizzle-kit's internal "pulling schema from database" step, regardless of `--ssl=require`/`--ssl=false`/config-file vs CLI flags. Confirmed this is drizzle-kit-specific, not a connectivity or SSL problem: a bare `postgres.js` script using the identical connection string and `ssl: 'require'` connects and queries instantly. Given time spent, didn't chase this further into drizzle-kit's internals — **worked around it by applying the generated SQL file directly**: `psql "$CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE" -v ON_ERROR_STOP=1 -f drizzle/0000_yummy_mentallo.sql`. All 9 tables + `order_status` enum + all FK constraints applied cleanly; confirmed with `\dt`.

**Consequence for later tickets**: `npm run db:generate` is safe and useful (pure local codegen, no DB connection). `npm run db:migrate`/`db:studio` are **not currently usable** — future schema changes need `db:generate` followed by manually applying the resulting SQL file via `psql` (as above), same workaround. Didn't fake-stamp drizzle-kit's migration journal table since the tool itself doesn't work here anyway — no benefit to pretending it does.

Also note: [Design the Postgres schema](01-schema-design.md)'s `src/db/schema.ts` module comment about `drizzle-orm` not being installed is now stale — it's installed and typechecking clean.
