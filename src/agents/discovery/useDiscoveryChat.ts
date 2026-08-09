import { useMemo } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useAgent } from "agents/react";
import { useUser } from "~/platform/user";
import { useDiscoveryConversations } from "~/platform/discovery";
import {
  getStoredAuthToken,
  getStoredCartSession,
  setStoredCartSession,
} from "~/platform/sillage-api-client";
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
 *
 * Chat history (a later addition, logged-in shoppers only): a guest's
 * identity is still the single fixed guest-session id above, unchanged —
 * there's no "list of past conversations" for guests since
 * conversation-registry.ts never persists anything for them. A logged-in
 * shopper's identity is instead a per-conversation uuid: the `c` search
 * param when present, else the most recently updated saved conversation,
 * else a fresh one for a first-ever chat.
 */
export function useDiscoveryChat() {
  const { user, isLoading } = useUser();
  // `strict: false` (not `from: "/discovery"`) deliberately — this hook now
  // also backs DiscoveryBubble, mounted globally in the root layout, so it
  // runs on every route, not just /discovery. `from: "/discovery"` throws
  // ("Could not find an active match") the moment it's called from anywhere
  // else; `strict: false` just reads whatever `c` the current route
  // happens to have (only /discovery ever declares one, so this is `{}`
  // everywhere else, which is exactly the "no override" case below).
  const search = useSearch({ strict: false }) as { c?: string };
  const navigate = useNavigate();

  const { conversations, isLoading: conversationsLoading } = useDiscoveryConversations(!!user);

  // Deferred until auth state (and, for logged-in shoppers, their
  // conversation list) settles, so the Agent is never opened under a
  // throwaway identity and then reconnected once the real one is known —
  // `startClosed` below holds the socket closed until this resolves, then
  // the name change opens it under the real identity in one transition.
  const identity = useMemo(() => {
    if (isLoading || typeof window === "undefined") return undefined;
    if (!user) return resolveGuestSessionId();
    if (conversationsLoading) return undefined;
    if (search.c) return search.c;
    return conversations[0]?.id ?? crypto.randomUUID();
  }, [isLoading, user, conversationsLoading, search.c, conversations]);

  // Ticket 03's wishlist signal (agent.ts's onConnect) needs a bearer token
  // to call sillage-api's auth-gated /v1/wishlist on the shopper's behalf.
  // Reuses the SAME stored token this app's other direct client-to-
  // sillage-api calls already send (sillage-api-client.ts's own doc
  // comment) — not a new credential path. Absent for guests, which is
  // expected (wishlist is a logged-in-only signal, per ticket 03).
  const authToken = getStoredAuthToken();
  const userId = user?.["@id"];

  const agent = useAgent<DiscoveryAgent, DiscoveryAgentState>({
    agent: "discovery-agent",
    name: identity ?? "pending",
    startClosed: !identity,
    query: { authToken: authToken ?? "", userId: userId ?? "" },
  });

  function newConversation() {
    navigate({ to: "/discovery", search: { c: crypto.randomUUID() } });
  }

  function switchConversation(id: string) {
    navigate({ to: "/discovery", search: { c: id } });
  }

  return {
    agent,
    connecting: !identity,
    conversations,
    activeConversationId: identity,
    canShowHistory: !!user,
    newConversation,
    switchConversation,
  };
}
