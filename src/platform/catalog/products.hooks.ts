import { useQuery } from "@tanstack/react-query";
import { sillageApiFetch } from "~/platform/sillage-api-client";
import type { CatalogEntry } from "./catalog.types";

export type SortKey = "recommended" | "price-asc" | "price-desc" | "name";

export interface ProductFilters {
  search?: string;
  family?: string[];
  brand?: string[];
  priceMin?: number;
  priceMax?: number;
  sort?: SortKey;
  page?: number;
  limit?: number;
}

export interface ProductListResult {
  items: CatalogEntry[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface FacetCounts {
  family: { value: string; count: number }[];
  brand: { value: string; count: number }[];
}

export function buildQueryString(filters: ProductFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  for (const f of filters.family ?? []) params.append("family", f);
  for (const b of filters.brand ?? []) params.append("brand", b);
  if (filters.priceMin !== undefined) params.set("priceMin", String(filters.priceMin));
  if (filters.priceMax !== undefined) params.set("priceMax", String(filters.priceMax));
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  return params.toString();
}

export const PRODUCTS_QUERY_KEY = (filters: ProductFilters) => ["products", filters] as const;

export function fetchProducts(filters: ProductFilters) {
  return sillageApiFetch<ProductListResult>(`/v1/products?${buildQueryString(filters)}`);
}

export function useProducts(filters: ProductFilters, options: { enabled?: boolean } = {}) {
  const query = useQuery({
    queryKey: PRODUCTS_QUERY_KEY(filters),
    queryFn: () => fetchProducts(filters),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    enabled: options.enabled,
  });
  return {
    items: query.data?.items ?? [],
    page: query.data?.page ?? 1,
    total: query.data?.total ?? 0,
    totalPages: query.data?.totalPages ?? 1,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  };
}

export const FACETS_QUERY_KEY = (filters: ProductFilters) => ["products", "facets", filters] as const;

/**
 * Facet counts. `family`/`brand` ARE passed through — sillage-api excludes
 * each facet from its own count (a selected family still filters the brand
 * counts, and vice versa; it just doesn't filter its own facet's counts).
 * `sort`/`page`/`limit` are meaningless here and dropped from the type.
 */
export function fetchProductFacets(filters: Omit<ProductFilters, "page" | "limit" | "sort">) {
  return sillageApiFetch<FacetCounts>(`/v1/products/facets?${buildQueryString(filters)}`);
}

export function useProductFacets(filters: Omit<ProductFilters, "page" | "limit" | "sort">) {
  const query = useQuery({
    queryKey: FACETS_QUERY_KEY(filters),
    queryFn: () => fetchProductFacets(filters),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
  return {
    family: query.data?.family ?? [],
    brand: query.data?.brand ?? [],
    isLoading: query.isLoading,
  };
}
