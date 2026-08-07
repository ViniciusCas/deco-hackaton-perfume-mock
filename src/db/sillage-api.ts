/**
 * Server-side fetch helper for calling sillage-api during SSR (createServerFn
 * handlers, route beforeLoad). See .scratch/backend-api/issues/06-ssr-token-forwarding.md:
 * SSR forwards the browser's already-present, already-signed session cookie
 * value verbatim as the bearer token — no new token-minting mechanism, no
 * dependency on the client-held `set-auth-token` value (that's only for
 * genuine client-side fetches straight from the browser to sillage-api).
 *
 * Not yet used by any route — wired in during the actual cart/wishlist/
 * address/orders frontend cutover (map's Destination, not done yet).
 */
import { getSessionCookie } from "better-auth/cookies";

const SILLAGE_API_COOKIE_PREFIX = "sillage";

export function sillageApiAuthHeader(request: Request): HeadersInit {
  const token = getSessionCookie(request, { cookiePrefix: SILLAGE_API_COOKIE_PREFIX });
  return token ? { authorization: `Bearer ${token}` } : {};
}

export function fetchSillageApi(
  baseUrl: string,
  request: Request,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...sillageApiAuthHeader(request), ...init.headers },
  });
}
