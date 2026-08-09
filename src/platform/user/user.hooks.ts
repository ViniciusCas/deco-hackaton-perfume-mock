import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { setStoredAuthToken } from "~/platform/sillage-api-client";
import { getUserServerFn, signInServerFn, signOutServerFn, signUpServerFn } from "./user.actions";
import type { AuthResult } from "./user.actions";
import type { Person } from "./user.types";

export const USER_QUERY_KEY = ["user"] as const;

export function useUser() {
  const query = useQuery({
    queryKey: USER_QUERY_KEY,
    queryFn: () => getUserServerFn(),
    staleTime: 60_000,
    placeholderData: null,
  });
  const user: Person | null = query.data ?? null;
  return {
    user,
    isAuthenticated: !!user?.email,
    isLoading: query.isLoading,
    error: query.error,
  };
}

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) => signInServerFn({ data: input }),
    onSuccess: (result: AuthResult) => {
      qc.setQueryData(USER_QUERY_KEY, result.user);
      setStoredAuthToken(result.authToken);
    },
  });
}

export function useSignUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      email: string;
      password: string;
      firstName?: string;
      lastName?: string;
    }) => signUpServerFn({ data: input }),
    onSuccess: (result: AuthResult) => {
      qc.setQueryData(USER_QUERY_KEY, result.user);
      setStoredAuthToken(result.authToken);
    },
  });
}

export function useSignOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => signOutServerFn(),
    onSuccess: () => {
      qc.setQueryData(USER_QUERY_KEY, null);
      setStoredAuthToken(null);
    },
  });
}

