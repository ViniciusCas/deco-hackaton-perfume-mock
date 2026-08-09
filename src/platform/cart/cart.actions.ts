import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { fetchSillageApi, sillageApiHeaders } from "~/db/sillage-api";
import type { CartState } from "./cart.types";

/**
 * SSR-only cart prefetch for the root route's beforeLoad — see
 * .scratch/backend-api/issues/09-guest-cart-ssr.md. `getRequest()` can't be
 * called directly from `beforeLoad` (that file is also bundled client-side);
 * wrapping it in createServerFn keeps it server-only, matching every other
 * SSR data fetch in this codebase (getUserServerFn, getCatalogServerFn).
 *
 * Only fetches when SSR already has something to identify the cart with (a
 * signed-in session cookie or an existing guest cart-session cookie) — a
 * brand-new guest gets no prefetch, since creating a cart from SSR with no
 * way to hand its session id back to the client would just orphan it.
 */
export const getCartSsrServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<CartState | null> => {
    const request = getRequest();
    const headers = sillageApiHeaders(request);
    if (Object.keys(headers).length === 0) return null;

    const res = await fetchSillageApi(request, "/v1/cart");
    const body = (await res.json().catch(() => ({}))) as { data?: CartState };
    return body.data ?? null;
  },
);
