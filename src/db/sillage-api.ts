/**
 * Server-side fetch helper for calling sillage-api during SSR (createServerFn
 * handlers, route beforeLoad). See .scratch/backend-api/issues/06-ssr-token-forwarding.md:
 * SSR forwards the browser's already-present, already-signed session cookie
 * value verbatim as the bearer token — no new token-minting mechanism, no
 * dependency on the client-held `set-auth-token` value (that's only for
 * genuine client-side fetches straight from the browser to sillage-api).
 *
 * Base URL comes from the same `VITE_SILLAGE_API_URL` (see .dev.vars) that
 * the client-side module (src/platform/sillage-api-client.ts) uses — Vite
 * exposes `VITE_`-prefixed vars via `import.meta.env` in both client and
 * SSR bundles, so this needs no separate `cloudflare:workers` env binding.
 */
import { getSessionCookie } from "better-auth/cookies";

const SILLAGE_API_COOKIE_PREFIX = "sillage";
const BASE_URL = import.meta.env.VITE_SILLAGE_API_URL ?? "https://sillage-api.sillage-hackaton.workers.dev";

export function sillageApiAuthHeader(request: Request): HeadersInit {
  const token = getSessionCookie(request, { cookiePrefix: SILLAGE_API_COOKIE_PREFIX });
  return token ? { authorization: `Bearer ${token}` } : {};
}

export function fetchSillageApi(
  request: Request,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...sillageApiAuthHeader(request), ...init.headers },
  });
}
