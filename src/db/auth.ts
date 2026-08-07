/**
 * Better Auth server instance — see .scratch/postgres-backend/issues/02-auth-model.md
 * for the decision (email+password only, Better Auth over hand-rolled hashing/
 * sessions, no verification/OAuth/password-reset for the hackathon scope).
 *
 * Built fresh per request, not as a module-level singleton: `getDb()` reads
 * the Hyperdrive binding off `cloudflare:workers` env, which is only
 * populated inside a request's execution context, same constraint as every
 * other DB access in this codebase (see src/db/client.ts).
 */
// @ts-expect-error -- ambient Cloudflare Workers module, no local types
import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getRequestUrl } from "@tanstack/react-start/server";
import { getDb } from "./client";
import * as schema from "./schema";

export function getAuth() {
  const secret = (env as { BETTER_AUTH_SECRET?: string }).BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET not found on cloudflare:workers env");

  // Deployed on workers.dev/preview subdomains (no fixed canonical host), so
  // baseURL is derived from the current request rather than hardcoded.
  let baseURL: string | undefined;
  try {
    baseURL = getRequestUrl().origin;
  } catch {
    baseURL = undefined;
  }

  return betterAuth({
    secret,
    baseURL,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    user: {
      additionalFields: {
        givenName: { type: "string", required: false },
        familyName: { type: "string", required: false },
      },
    },
    session: {
      // 30-day fixed expiry, no sliding renewal — see ticket 02's answer.
      expiresIn: 60 * 60 * 24 * 30,
      disableSessionRefresh: true,
    },
    advanced: {
      cookiePrefix: "sillage",
    },
  });
}
