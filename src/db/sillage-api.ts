/**
 * Server-side fetch helper for calling sillage-api during SSR (createServerFn
 * handlers, route beforeLoad). See .scratch/backend-api/issues/06-ssr-token-forwarding.md:
 * SSR forwards the browser's already-present, already-signed session cookie
 * value verbatim as the bearer token — no new token-minting mechanism, no
 * dependency on the client-held `set-auth-token` value (that's only for
 * genuine client-side fetches straight from the browser to sillage-api).
 *
 * Guest cart identity (.scratch/backend-api/issues/09-guest-cart-ssr.md)
 * follows the same pattern: `CART_SESSION_COOKIE` is a first-party cookie
 * this website itself sets (src/platform/sillage-api-client.ts), so SSR can
 * read it directly off the incoming request too — unlike the earlier
 * localStorage-only approach, which SSR had no access to at all.
 *
 * Base URL comes from the same `VITE_SILLAGE_API_URL` (see .dev.vars) that
 * the client-side module (src/platform/sillage-api-client.ts) uses — Vite
 * exposes `VITE_`-prefixed vars via `import.meta.env` in both client and
 * SSR bundles, so this needs no separate `cloudflare:workers` env binding.
 */
import { getSessionCookie } from "better-auth/cookies";
import { CART_SESSION_COOKIE } from "~/platform/sillage-api-client";

const SILLAGE_API_COOKIE_PREFIX = "sillage";
const BASE_URL = import.meta.env.VITE_SILLAGE_API_URL ?? "https://sillage-api.sillage-hackaton.workers.dev";

function readRequestCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  const match = header.split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function sillageApiHeaders(request: Request): HeadersInit {
  const headers: Record<string, string> = {};

  const token = getSessionCookie(request, { cookiePrefix: SILLAGE_API_COOKIE_PREFIX });
  if (token) headers.authorization = `Bearer ${token}`;

  const cartSession = readRequestCookie(request, CART_SESSION_COOKIE);
  if (cartSession) headers["x-cart-session"] = cartSession;

  return headers;
}

export function fetchSillageApi(
  request: Request,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...sillageApiHeaders(request), ...init.headers },
  });
}
