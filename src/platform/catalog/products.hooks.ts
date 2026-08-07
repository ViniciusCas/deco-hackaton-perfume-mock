import { useQuery } from "@tanstack/react-query";
import { sillageApiFetch } from "~/platform/sillage-api-client";
import type { CatalogEntry, ProductVariant } from "./catalog.types";

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

/** Cross-references a list of product ids (e.g. wishlisted product ids)
 * against sillage-api directly, rather than fetching the whole catalog and
 * filtering client-side. Empty `ids` short-circuits without a request. */
export function useProductsByIds(ids: string[]) {
  const query = useQuery({
    queryKey: ["products", "byIds", ids] as const,
    queryFn: () => sillageApiFetch<ProductListResult>(`/v1/products?ids=${ids.join(",")}`),
    enabled: ids.length > 0,
    staleTime: 30_000,
  });
  return { items: query.data?.items ?? [], isLoading: query.isLoading };
}

// Query key + fetch fn pairs exported separately (not just wrapped in a
// hook) so a route `loader` can prefetch with the exact same cache key the
// component's hook uses — see fragrance.tsx's loader for the established
// pattern (and why: `sillageApiFetch` has no server-only imports, so a
// plain loader + `.catch(() => {})` per call works without a `createServerFn`
// wrapper, but DOES need individual `.catch`es — an unhandled rejection
// here previously crashed /fragrance in production).

export const PRODUCT_DETAIL_QUERY_KEY = (slug: string) => ["products", "detail", slug] as const;
export function fetchProductDetail(slug: string) {
  return sillageApiFetch<CatalogEntry>(`/v1/products/${slug}`);
}
export function useProductDetail(slug: string) {
  const query = useQuery({
    queryKey: PRODUCT_DETAIL_QUERY_KEY(slug),
    queryFn: () => fetchProductDetail(slug),
    enabled: Boolean(slug),
    staleTime: 30_000,
  });
  return { entry: query.data, isLoading: query.isLoading };
}

export const PRODUCT_VARIANTS_QUERY_KEY = (slug: string) => ["products", "variants", slug] as const;
export function fetchProductVariants(slug: string) {
  return sillageApiFetch<ProductVariant[]>(`/v1/products/${slug}/variants`);
}
export function useProductVariants(slug: string) {
  const query = useQuery({
    queryKey: PRODUCT_VARIANTS_QUERY_KEY(slug),
    queryFn: () => fetchProductVariants(slug),
    enabled: Boolean(slug),
    staleTime: 30_000,
  });
  return { variants: query.data ?? [], isLoading: query.isLoading };
}

export const RELATED_PRODUCTS_QUERY_KEY = (slug: string, limit: number) =>
  ["products", "related", slug, limit] as const;
export function fetchRelatedProducts(slug: string, limit: number) {
  return sillageApiFetch<CatalogEntry[]>(`/v1/products/related/${slug}?limit=${limit}`);
}
export function useRelatedProducts(slug: string, limit = 4) {
  const query = useQuery({
    queryKey: RELATED_PRODUCTS_QUERY_KEY(slug, limit),
    queryFn: () => fetchRelatedProducts(slug, limit),
    enabled: Boolean(slug),
    staleTime: 30_000,
  });
  return { items: query.data ?? [], isLoading: query.isLoading };
}

export interface HomeCollections {
  arrivals: CatalogEntry[];
  bestSellers: CatalogEntry[];
}

export const HOME_COLLECTIONS_QUERY_KEY = ["products", "home-collections"] as const;
export function fetchHomeCollections() {
  return sillageApiFetch<HomeCollections>("/v1/products/home-collections");
}

export function useHomeCollections() {
  const query = useQuery({
    queryKey: HOME_COLLECTIONS_QUERY_KEY,
    queryFn: fetchHomeCollections,
    staleTime: 30_000,
  });
  return {
    arrivals: query.data?.arrivals ?? [],
    bestSellers: query.data?.bestSellers ?? [],
    isLoading: query.isLoading,
  };
}
