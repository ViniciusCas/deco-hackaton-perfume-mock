/**
 * DB client for use inside `createServerFn` handlers (Cloudflare Workers runtime).
 *
 * Config here is load-bearing, not stylistic — see
 * .scratch/postgres-backend/issues/03-provision-hyperdrive.md:
 * - `prepare: false` — Hyperdrive's connection pooling doesn't support
 *   server-side prepared statements; without this it hangs, not errors.
 * - No `ssl` option at all — Hyperdrive terminates TLS to RDS itself, and
 *   asking it to negotiate SSL from the Worker side also hangs. Do not add
 *   `ssl: false` either — an explicit key (even `false`) reproduces the hang.
 * - `fetch_types: false` — skips a schema-introspection query on connect;
 *   Cloudflare's standard Hyperdrive recommendation.
 *
 * Local dev (`vite dev`) connects to a local Postgres container instead of
 * Hyperdrive — see `docker-compose.yml` and `.dev.vars`. `@cloudflare/vite-plugin`'s
 * local Hyperdrive emulation refuses to target a remote host at all, and
 * separately, direct TLS negotiation to RDS hangs in the local Miniflare
 * socket layer — a local, non-TLS Postgres sidesteps both (see the map's
 * "local dev DB story" note).
 */
// @ts-expect-error -- ambient Cloudflare Workers module, no local types
import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function getDb() {
  const binding = (env as { HYPERDRIVE?: { connectionString: string } }).HYPERDRIVE;
  if (!binding) throw new Error("HYPERDRIVE binding not found on cloudflare:workers env");

  const sql = postgres(binding.connectionString, {
    max: 5,
    fetch_types: false,
    prepare: false,
  });

  return drizzle(sql, { schema });
}
