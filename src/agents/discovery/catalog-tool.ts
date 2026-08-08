import { tool } from "ai";
import { z } from "zod";
import type { ConversationStore } from "./state";

/**
 * Catalog tool for the discovery-chat agent. Calls sillage-api's real
 * GET /v1/products directly (this Agent runs inside the same Worker per
 * ticket 06, no auth/cookie forwarding needed — catalog search is public,
 * same as the storefront's own anonymous browsing).
 *
 * v1 scope per ticket 02/06: only the params sillage-api's list endpoint
 * actually supports today (search, family[], brand[], priceMin/priceMax,
 * sort) — no accords/notes/longevity/sillage/rating/votes/gender/
 * releaseYear. That's a known, deliberate gap (fast-follow, not a
 * blocker), not an oversight — do not add params sillage-api doesn't
 * support, see ticket 02's gap table.
 */

// Same pattern as deco-hackaton-perfume-mock/src/db/sillage-api.ts's
// BASE_URL — reused for consistency, not re-derived.
const SILLAGE_API_BASE_URL =
  import.meta.env.VITE_SILLAGE_API_URL ?? "https://sillage-api.sillage-hackaton.workers.dev";

interface SillageProductRow {
  id: string;
  slug: string;
  name: string;
  brand: string;
  family: string;
  notes: string;
  price: number;
  rating: number;
  image: string;
  tag?: string;
}

interface SillageListResponse {
  data?: { items: SillageProductRow[] };
}

const SORTS = ["recommended", "price-asc", "price-desc", "name"] as const;
export type SortKey = (typeof SORTS)[number];

/** Low-level fetch against sillage-api's list endpoint — exported so
 * Phase 4 can reuse it for full-detail recommendation rendering without
 * duplicating the fetch/parse logic. */
export async function fetchProducts(params: {
  search?: string;
  family?: string[];
  brand?: string[];
  priceMin?: number;
  priceMax?: number;
  sort?: SortKey;
  limit?: number;
}): Promise<SillageProductRow[]> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  for (const f of params.family ?? []) qs.append("family", f);
  for (const b of params.brand ?? []) qs.append("brand", b);
  if (params.priceMin !== undefined) qs.set("priceMin", String(params.priceMin));
  if (params.priceMax !== undefined) qs.set("priceMax", String(params.priceMax));
  if (params.sort) qs.set("sort", params.sort);
  if (params.limit !== undefined) qs.set("limit", String(params.limit));

  const res = await fetch(`${SILLAGE_API_BASE_URL}/v1/products?${qs}`);
  const body = (await res.json().catch(() => ({}))) as SillageListResponse;
  return body.data?.items ?? [];
}

/** Fetch an exact set of products by id — sillage-api's `ids` escape
 * hatch, bypassing all filtering/sort/pagination server-side (see
 * products.ts:172-190). Exported for Phase 4's recommendation rendering. */
export async function fetchProductsByIds(ids: string[]): Promise<SillageProductRow[]> {
  if (ids.length === 0) return [];
  const res = await fetch(`${SILLAGE_API_BASE_URL}/v1/products?ids=${ids.join(",")}`);
  const body = (await res.json().catch(() => ({}))) as SillageListResponse;
  return body.data?.items ?? [];
}

function matchesClientSideFilters(
  row: SillageProductRow,
  filters: { search?: string; family?: string[]; brand?: string[]; priceMin?: number; priceMax?: number },
): boolean {
  if (filters.family?.length && !filters.family.includes(row.family)) return false;
  if (filters.brand?.length && !filters.brand.includes(row.brand)) return false;
  if (filters.priceMin !== undefined && row.price < filters.priceMin) return false;
  if (filters.priceMax !== undefined && row.price > filters.priceMax) return false;
  if (filters.search) {
    const term = filters.search.toLowerCase();
    const haystack = `${row.name} ${row.brand} ${row.notes}`.toLowerCase();
    if (!haystack.includes(term)) return false;
  }
  return true;
}

function sortRows(rows: SillageProductRow[], sort: SortKey | undefined): SillageProductRow[] {
  const sorted = [...rows];
  switch (sort) {
    case "price-asc":
      return sorted.sort((a, b) => a.price - b.price);
    case "price-desc":
      return sorted.sort((a, b) => b.price - a.price);
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    default:
      // "recommended" — rows already arrive pre-sorted by rating/votes
      // when fetched fresh; when narrowing an existing (already labeled)
      // shortlist via restrictToIds, preserve that prior order rather
      // than re-deriving a ranking client-side.
      return sorted;
  }
}

const CatalogQueryInputSchema = z.object({
  search: z
    .string()
    .optional()
    .describe("Free-text search over product name, brand, and notes"),
  family: z
    .array(z.string())
    .optional()
    .describe("Scent family filter, e.g. ['Citrus', 'Woody'] — values come from the catalog itself, don't guess names"),
  brand: z.array(z.string()).optional().describe("Brand filter"),
  priceMin: z.number().optional().describe("Minimum price"),
  priceMax: z.number().optional().describe("Maximum price"),
  sort: z.enum(SORTS).optional().describe("Sort order — defaults to 'recommended' (rating/popularity) if omitted"),
  restrict_to_ids: z
    .array(z.string())
    .optional()
    .describe(
      "Pass the current shortlist of product LABELS (the 'label' field from a previous " +
        "result, e.g. 'P3') to narrow within it. Omit this ONLY on the very first query of a " +
        "round, when no shortlist exists yet.",
    ),
  limit: z.number().optional().describe("Maximum number of products to return (default 8)"),
});

/**
 * Factory, not a static tool — execute() needs the per-conversation
 * ConversationStore to assign/resolve short labels, matching how Python's
 * CatalogQueryTool was instantiated per-Flow-run with a `catalog`
 * reference (sales-agent/.../tools.py).
 */
export function createSearchCatalogTool(store: ConversationStore) {
  return tool({
    description:
      "Search the fragrance catalog by scent family, brand, price range, or free text. " +
      "Returns a shortlist of matching products with a short label for each — use that exact " +
      "label (never the product name) when narrowing the shortlist or recommending.",
    inputSchema: CatalogQueryInputSchema,
    execute: async (args) => {
      const limit = args.limit ?? 8;
      let rows: SillageProductRow[];

      if (args.restrict_to_ids && args.restrict_to_ids.length > 0) {
        // Narrowing an existing shortlist: sillage-api's `ids` param
        // bypasses all its own filtering (products.ts:172-190), so any
        // *additional* filters this call also supplies have to be applied
        // client-side over that already-small (<= candidate_cap) result —
        // there's no server-side way to combine "these exact ids" with
        // "and also match these filters" in one sillage-api call today.
        const ids = store.idsForLabels(args.restrict_to_ids);
        const fetched = await fetchProductsByIds(ids);
        // sillage-api's `ids` lookup (WHERE id IN (...)) doesn't preserve
        // the requested order — restore it here so sortRows' "no explicit
        // sort" branch actually preserves the prior shortlist order it
        // claims to, instead of whatever order the DB happened to return.
        const orderIndex = new Map(ids.map((id, i) => [id, i]));
        const candidates = [...fetched].sort(
          (a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0),
        );
        rows = sortRows(
          candidates.filter((row) => matchesClientSideFilters(row, args)),
          args.sort,
        ).slice(0, limit);
      } else {
        rows = await fetchProducts({ ...args, limit });
      }

      if (rows.length === 0) {
        // Ticket 08 signal 3: zero-result catalog queries — the shopper's
        // filter combination genuinely doesn't exist in the catalog,
        // useful for spotting a model that's inventing attributes the
        // catalog doesn't have or a filter combo worth adding a fast-follow
        // param for (see this file's header note on v1 scope gaps).
        console.log("discovery-agent:zero-results", JSON.stringify(args));
      }

      return rows.map((row) => ({
        label: store.labelForId(row.id),
        name: row.name,
        brand: row.brand,
        family: row.family,
        price: row.price,
        rating: row.rating,
      }));
    },
  });
}
