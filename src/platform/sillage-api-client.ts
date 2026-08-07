/**
 * Shared client-side (browser) fetch wrapper for sillage-api. See
 * .scratch/backend-api/issues/07-frontend-cutover.md for the decisions this
 * implements: localStorage for the bearer token and guest cart-session id,
 * a single shared client, `{ data }` / `{ error }` envelope unwrapping into
 * a typed SillageApiError.
 *
 * Server-side (SSR) calls do NOT go through this module — see
 * src/db/sillage-api.ts, which forwards the browser's own session cookie
 * instead of a stored token (no localStorage access during SSR).
 */
const BASE_URL = import.meta.env.VITE_SILLAGE_API_URL ?? "https://sillage-api.sillage-hackaton.workers.dev";

const AUTH_TOKEN_KEY = "sillage_auth_token";
const CART_SESSION_KEY = "sillage_cart_session";

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function writeStorage(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  if (value) window.localStorage.setItem(key, value);
  else window.localStorage.removeItem(key);
}

export const getStoredAuthToken = () => readStorage(AUTH_TOKEN_KEY);
export const setStoredAuthToken = (token: string | null) => writeStorage(AUTH_TOKEN_KEY, token);

export const getStoredCartSession = () => readStorage(CART_SESSION_KEY);
export const setStoredCartSession = (token: string | null) => writeStorage(CART_SESSION_KEY, token);

export class SillageApiError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "SillageApiError";
    this.code = code;
    this.details = details;
  }
}

interface Envelope<T> {
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

/**
 * Cart responses always include `sessionToken` — persist it so guest
 * identity survives across requests without the caller having to remember to.
 */
function captureCartSession(data: unknown) {
  if (data && typeof data === "object" && "sessionToken" in data) {
    const token = (data as { sessionToken?: unknown }).sessionToken;
    if (typeof token === "string") setStoredCartSession(token);
  }
}

export async function sillageApiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  const authToken = getStoredAuthToken();
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);

  const cartSession = getStoredCartSession();
  if (cartSession) headers.set("X-Cart-Session", cartSession);

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  const body = (await res.json().catch(() => ({}))) as Envelope<T>;

  if (!res.ok || body.error) {
    const { code = "unknown_error", message = "Something went wrong.", details } = body.error ?? {};
    throw new SillageApiError(code, message, details);
  }

  captureCartSession(body.data);
  return body.data as T;
}
