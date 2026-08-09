import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sillageApiFetch } from "~/platform/sillage-api-client";
import { type Address, type AddressBookState, EMPTY_ADDRESS_BOOK } from "./address.types";

export const ADDRESS_QUERY_KEY = ["addresses"] as const;

export type AddressInput = Omit<Address, "id"> & { id?: string };

export function useAddresses() {
  const query = useQuery({
    queryKey: ADDRESS_QUERY_KEY,
    queryFn: () => sillageApiFetch<AddressBookState>("/v1/addresses"),
    staleTime: 60_000,
    placeholderData: EMPTY_ADDRESS_BOOK,
  });
  return {
    addresses: (query.data ?? EMPTY_ADDRESS_BOOK).addresses,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
  };
}

// Mutations reconcile via onSuccess (the server assigns ids and enforces the
// single-default invariant, so an optimistic guess would be unreliable).
function useAddressMutation<TInput>(run: (input: TInput) => Promise<AddressBookState>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (state) => qc.setQueryData(ADDRESS_QUERY_KEY, state),
  });
}

export function useSaveAddress() {
  return useAddressMutation<AddressInput>(({ id, ...address }) =>
    sillageApiFetch<AddressBookState>(id ? `/v1/addresses/${id}` : "/v1/addresses", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(address),
    }),
  );
}

export function useRemoveAddress() {
  return useAddressMutation<string>((id) =>
    sillageApiFetch<AddressBookState>(`/v1/addresses/${id}`, { method: "DELETE" }),
  );
}

export function useSetDefaultAddress() {
  return useAddressMutation<string>((id) =>
    sillageApiFetch<AddressBookState>(`/v1/addresses/${id}/default`, { method: "POST" }),
  );
}
