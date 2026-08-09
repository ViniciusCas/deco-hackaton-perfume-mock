import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sillageApiFetch } from "~/platform/sillage-api-client";
import { CART_QUERY_KEY } from "~/platform/cart";
import type { CheckoutInput, Order } from "./orders.types";

/**
 * Checkout only — no order list/history endpoint yet (ticket 02's answer).
 * No consuming UI wired up yet either; the map's Destination stops at
 * cart/wishlist/address, checkout UI is still fog. See
 * .scratch/backend-api/issues/07-frontend-cutover.md.
 */
export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CheckoutInput) =>
      sillageApiFetch<Order>("/v1/orders", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CART_QUERY_KEY });
    },
  });
}
