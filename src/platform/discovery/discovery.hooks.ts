import { useQuery } from "@tanstack/react-query";
import { listCatalogGapsFn, listDiscoveryConversationsFn } from "./discovery.actions";

export const DISCOVERY_CONVERSATIONS_QUERY_KEY = ["discovery", "conversations"] as const;
export const CATALOG_GAPS_QUERY_KEY = ["discovery", "catalog-gaps"] as const;

/** `enabled` gate is the caller's job (pass whether the shopper is logged
 * in) — this hook itself just runs the query and returns `[]` while
 * disabled/loading, same shape as every other list-state hook here. */
export function useDiscoveryConversations(enabled: boolean) {
  const query = useQuery({
    queryKey: DISCOVERY_CONVERSATIONS_QUERY_KEY,
    queryFn: () => listDiscoveryConversationsFn(),
    enabled,
    staleTime: 10_000,
  });
  return {
    conversations: query.data ?? [],
    isLoading: enabled && query.isLoading,
    refetch: query.refetch,
  };
}

/** Same enabled-gate shape as useDiscoveryConversations — the caller
 * passes whether the viewer is logged in (listCatalogGapsFn itself also
 * checks server-side, this just avoids firing the request at all when
 * we already know it'll come back empty). */
export function useCatalogGaps(enabled: boolean) {
  const query = useQuery({
    queryKey: CATALOG_GAPS_QUERY_KEY,
    queryFn: () => listCatalogGapsFn(),
    enabled,
    staleTime: 10_000,
  });
  return {
    gaps: query.data ?? [],
    isLoading: enabled && query.isLoading,
  };
}
