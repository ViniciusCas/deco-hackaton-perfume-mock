import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sillageApiFetch } from "~/platform/sillage-api-client";
import { EMPTY_WISHLIST, type WishlistState } from "./wishlist.types";

export const WISHLIST_QUERY_KEY = ["wishlist"] as const;

export function useWishlist() {
  const query = useQuery({
    queryKey: WISHLIST_QUERY_KEY,
    queryFn: () => sillageApiFetch<WishlistState>("/v1/wishlist"),
    staleTime: 60_000,
    placeholderData: EMPTY_WISHLIST,
  });
  const wishlist = query.data ?? EMPTY_WISHLIST;
  return {
    wishlist,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    isInWishlist: (productID: string) => wishlist.productIds.includes(productID),
  };
}

export interface ToggleWishlistInput {
  productID: string;
  /** Caller already knows current membership (useWishlist().isInWishlist) — avoids a cache read inside mutationFn racing onMutate's optimistic write. */
  inWishlist: boolean;
}

export function useToggleWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productID, inWishlist }: ToggleWishlistInput): Promise<WishlistState> =>
      sillageApiFetch<WishlistState>(`/v1/wishlist/${productID}`, {
        method: inWishlist ? "DELETE" : "POST",
      }),
    onMutate: async ({ productID }) => {
      await qc.cancelQueries({ queryKey: WISHLIST_QUERY_KEY });
      const prev = qc.getQueryData<WishlistState>(WISHLIST_QUERY_KEY) ?? EMPTY_WISHLIST;
      const next: WishlistState = prev.productIds.includes(productID)
        ? { productIds: prev.productIds.filter((id) => id !== productID) }
        : { productIds: [...prev.productIds, productID] };
      qc.setQueryData(WISHLIST_QUERY_KEY, next);
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(WISHLIST_QUERY_KEY, ctx.prev);
    },
    onSuccess: (server) => qc.setQueryData(WISHLIST_QUERY_KEY, server),
  });
}
