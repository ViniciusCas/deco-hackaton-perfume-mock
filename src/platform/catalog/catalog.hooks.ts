import { useQuery } from "@tanstack/react-query";
import { getCatalogServerFn } from "./catalog.actions";
import type { CatalogEntry } from "./catalog.types";

export const CATALOG_QUERY_KEY = ["catalog"] as const;

/**
 * The full catalog, fetched once and cached (see __root.tsx's `beforeLoad`
 * prefetch — this hook is what the header searchbar, /fragrance, and
 * /discovery all read from the same warm cache). Filtering/sorting stays
 * client-side on this array, same as the old static `CATALOG` import.
 */
export function useCatalog() {
  const query = useQuery({
    queryKey: CATALOG_QUERY_KEY,
    queryFn: () => getCatalogServerFn(),
    staleTime: 60_000,
  });
  return { catalog: (query.data ?? []) as CatalogEntry[], isLoading: query.isLoading };
}
