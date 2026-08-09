// drizzle-kit runs as a plain Node CLI (not inside the Workers runtime), so
// it connects to RDS directly with a normal SSL connection — unrelated to
// the Hyperdrive-specific quirks documented in src/db/client.ts.
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".dev.vars" });

const connectionString =
  process.env.DATABASE_URL ?? process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE;

if (!connectionString) {
  throw new Error(
    "Set DATABASE_URL (or CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE) in .dev.vars to run drizzle-kit.",
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
    ssl: "require",
  },
});
