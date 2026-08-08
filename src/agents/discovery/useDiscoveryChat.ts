import { useMemo } from "react";
import { useAgent } from "agents/react";
import { useUser } from "~/platform/user";
import { getStoredCartSession, setStoredCartSession } from "~/platform/sillage-api-client";
import type { DiscoveryAgent } from "./agent";
import type { DiscoveryAgentState } from "./state";

/**
 * Ticket 03's identity resolution, client-side: the logged-in user's id, or
 * else the same `x-cart-session` cookie guest carts/wishlists already use
 * (`CART_SESSION_COOKIE` via sillage-api-client.ts) — reused, not
 * reinvented, per ticket 03's "mirrors sillageApiHeaders()" resolution.
 * Unlike the server-side version (a Request's cookie header), this needs a
 * client-writable fallback: nothing in this codebase currently *creates*
 * that cookie for a guest who's never touched their cart, so a first-ever
 * discovery-chat visitor generates and persists one here.
 */
function resolveGuestSessionId(): string {
  const existing = getStoredCartSession();
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  setStoredCartSession(fresh);
  return fresh;
}

/**
 * Thin wrapper around `useAgent` (ticket 10's resolution) — resolves which
 * Agent instance to connect to and types `submitTurn`/`respondToRecommendation`
 * request/response shapes. Not a React Query hook: this is a live stateful
 * WebSocket connection, and ticket 10 explicitly ruled out forcing it
 * through React Query's fetch/cache model.
 */
export function useDiscoveryChat() {
  const { user, isLoading } = useUser();

  // Deferred until auth state settles so the Agent is never opened under a
  // throwaway identity and then reconnected once the real one is known —
  // `startClosed` below holds the socket closed until this resolves, then
  // the name change opens it under the real identity in one transition.
  const identity = useMemo(() => {
    if (isLoading || typeof window === "undefined") return undefined;
    return user?.["@id"] ?? resolveGuestSessionId();
  }, [isLoading, user]);

  const agent = useAgent<DiscoveryAgent, DiscoveryAgentState>({
    agent: "discovery-agent",
    name: identity ?? "pending",
    startClosed: !identity,
  });

  return { agent, connecting: !identity };
}
