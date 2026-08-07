import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import ProductTile from "~/components/home/ProductTile";
import {
  fetchProductFacets,
  fetchProducts,
  FACETS_QUERY_KEY,
  PRODUCTS_QUERY_KEY,
  useProductFacets,
  useProducts,
  type ProductFilters,
  type SortKey,
} from "~/platform/catalog/products.hooks";
import { useEscapeKey } from "~/sdk/useEscapeKey";
import { useDebouncedValue } from "~/sdk/useDebouncedValue";

type PriceBucketKey = "under-80" | "80-110" | "110-130" | "130-plus";

const PRICE_BUCKETS: { key: PriceBucketKey; label: string; min?: number; max?: number }[] = [
  { key: "under-80", label: "Under $80", max: 79.99 },
  { key: "80-110", label: "$80 – $110", min: 80, max: 109.99 },
  { key: "110-130", label: "$110 – $130", min: 110, max: 129.99 },
  { key: "130-plus", label: "$130+", min: 130 },
];

interface FragranceSearch {
  q?: string;
  family?: string[];
  brand?: string[];
  price?: PriceBucketKey;
  sort?: SortKey;
  page?: number;
}

const PAGE_SIZE = 24;

/** Shared between the SSR loader and the component so both derive the exact
 * same filters (and therefore the exact same React Query cache key) from
 * the URL's search params — the loader's prefetch only avoids a flash if
 * its cache key matches what the component itself queries for. */
function deriveFilters(search: FragranceSearch): Omit<ProductFilters, "sort" | "page" | "limit"> {
  const bucket = PRICE_BUCKETS.find((b) => b.key === search.price);
  return {
    search: search.q?.trim() || undefined,
    family: search.family ?? [],
    brand: search.brand ?? [],
    priceMin: bucket?.min,
    priceMax: bucket?.max,
  };
}

/** Raw URL query params are always strings — a single `?family=Woody` parses
 * to the string "Woody", not `["Woody"]`, and only becomes an array when the
 * param repeats (`?family=Woody&family=Amber`). Normalize both cases. */
function toStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value) return [value];
  return undefined;
}

export const Route = createFileRoute("/fragrance")({
  component: FragrancePage,
  validateSearch: (search: Record<string, unknown>): FragranceSearch => ({
    q: typeof search.q === "string" ? search.q : undefined,
    family: toStringArray(search.family),
    brand: toStringArray(search.brand),
    price: typeof search.price === "string" ? (search.price as PriceBucketKey) : undefined,
    sort: typeof search.sort === "string" ? (search.sort as SortKey) : undefined,
    // Raw URL params are strings ("2"), not numbers — coerce explicitly;
    // `typeof search.page === "number"` would silently drop every real URL.
    page: (() => {
      const n = Number(search.page);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    })(),
  }),
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ context, deps }) => {
    const filters = deriveFilters(deps.search);
    const listFilters: ProductFilters = {
      ...filters,
      sort: deps.search.sort ?? "recommended",
      page: deps.search.page ?? 1,
      limit: PAGE_SIZE,
    };
    // SSR prefetch — without this, the client-side useProducts()/
    // useProductFacets() calls in the component have nothing cached yet at
    // first paint, so the page would render "0 fragrances" until hydration
    // resolves. No cookie/auth forwarding needed (catalog is public), so
    // this calls sillageApiFetch directly rather than needing a
    // createServerFn wrapper (that's only required for server-only imports
    // like getRequest(), which cart's SSR prefetch needs and this doesn't).
    //
    // Each `.catch(() => {})` individually (not one around the whole
    // Promise.all) — matches every other SSR prefetch in this codebase
    // (__root.tsx's cart/user/catalog prefetches). A transient failure
    // calling sillage-api (cold start, subrequest hiccup) degrades to the
    // client-side fetch instead of crashing the whole route: this was a
    // real bug, not theoretical — an unhandled rejection here threw
    // uncaught through the loader and 500'd every production request until
    // fixed, reproduced via `wrangler dev --remote` against the exact
    // deployed build.
    await Promise.all([
      context.queryClient
        .ensureQueryData({
          queryKey: PRODUCTS_QUERY_KEY(listFilters),
          queryFn: () => fetchProducts(listFilters),
        })
        .catch(() => {}),
      context.queryClient
        .ensureQueryData({
          queryKey: FACETS_QUERY_KEY(filters),
          queryFn: () => fetchProductFacets(filters),
        })
        .catch(() => {}),
    ]);
  },
});

const LABEL_CLASS = "font-display text-2xs font-medium tracking-(--tracking-label) uppercase";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recommended", label: "Recommended" },
  { key: "price-asc", label: "Price: Low to High" },
  { key: "price-desc", label: "Price: High to Low" },
  { key: "name", label: "Name A–Z" },
];

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
    </svg>
  );
}

function CheckRow({
  label,
  count,
  checked,
  onToggle,
}: {
  label: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="group flex w-full items-center gap-2.5 py-1.5 text-left"
    >
      <span
        className={`tap-scale flex size-4 shrink-0 items-center justify-center rounded-xs ring-1 transition-colors duration-(--duration-fast) ${
          checked ? "bg-rose ring-rose" : "ring-gray-300 group-hover:ring-ink"
        }`}
        aria-hidden="true"
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="flex-1 text-sm text-ink-soft capitalize">{label}</span>
      <span className="text-xs text-muted">({count})</span>
    </button>
  );
}

function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

/** Page numbers to render: all of them under 8 pages, otherwise a window
 * around the current page plus the first/last page, with gaps as `null`. */
function pageWindow(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const withGaps: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) withGaps.push(null);
    withGaps.push(p);
  });
  return withGaps;
}

function FragrancePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [query, setQuery] = useState(search.q ?? "");
  const families = search.family ?? [];
  const brands = search.brand ?? [];
  const priceBucket = search.price ?? null;
  const sort = search.sort ?? "recommended";
  const page = search.page ?? 1;
  const [filterOpen, setFilterOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  useEscapeKey(() => setFilterOpen(false));

  // The searchbar can send a fresh `q` while this page is already open
  // (same route, only the search param changes — no remount), so pick it
  // up whenever it changes rather than just on first render.
  useEffect(() => {
    setQuery(search.q ?? "");
  }, [search.q]);

  const debouncedQuery = useDebouncedValue(query, 300);

  const bucket = PRICE_BUCKETS.find((b) => b.key === priceBucket);
  const baseFilters = {
    search: debouncedQuery.trim() || undefined,
    family: families,
    brand: brands,
    priceMin: bucket?.min,
    priceMax: bucket?.max,
  };

  const { items, total, totalPages, isFetching } = useProducts({
    ...baseFilters,
    sort,
    page,
    limit: PAGE_SIZE,
  });
  const facets = useProductFacets(baseFilters);

  const familyOptions = [...facets.family].sort((a, b) => b.count - a.count);
  const brandOptions = [...facets.brand].sort((a, b) => a.value.localeCompare(b.value));

  // Updates the URL (shareable/bookmarkable filter state) — `replace` so
  // rapid filter toggling doesn't spam browser history.
  function updateSearch(patch: Partial<FragranceSearch>, resetPage = true) {
    navigate({
      search: (prev) => ({
        ...prev,
        ...patch,
        page: resetPage ? undefined : (patch.page ?? prev.page),
      }),
      replace: true,
    });
  }

  const goToPage = (next: number) => {
    updateSearch({ page: Math.min(Math.max(next, 1), totalPages) }, false);
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const activeCount =
    families.length + brands.length + (priceBucket ? 1 : 0) + (query.trim() ? 1 : 0);

  const clearAll = () => {
    setQuery("");
    navigate({ search: {}, replace: true });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-[90px] pb-14 sm:px-8 sm:pt-[110px]">
      <div className="mb-6 sm:mb-8">
        <div className={`${LABEL_CLASS} mb-3 text-accent`}>Full collection</div>
        <h1 className="font-display text-4xl font-light text-ink sm:text-5xl">Fragrance</h1>
        <p className="mt-3 max-w-xl text-sm text-muted sm:text-base">
          {query.trim()
            ? `${total} results for “${query.trim()}”`
            : `${total} fragrances, from everyday signatures to statement scents.`}
        </p>
      </div>

      <div className="mb-5 flex items-center justify-between gap-3 border-b border-line pb-4">
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="tap-scale flex items-center gap-2 rounded-sm border border-line-strong px-4 py-2.5 text-sm text-ink"
        >
          <FilterIcon />
          Filters
          {activeCount > 0 && (
            <span className="flex size-4.5 items-center justify-center rounded-full bg-rose text-[10px] font-medium text-black">
              {activeCount}
            </span>
          )}
        </button>

        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="hidden sm:inline">Sort</span>
          <select
            value={sort}
            onChange={(e) => updateSearch({ sort: e.target.value as SortKey })}
            className="rounded-sm border border-line-strong bg-transparent px-3 py-2.5 text-sm text-ink focus:border-ink focus:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {activeCount > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {query.trim() && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                updateSearch({ q: undefined });
              }}
              className={`${LABEL_CLASS} tap-scale flex items-center gap-1.5 rounded-full bg-blush-deep px-3 py-1.5 text-ink`}
            >
              “{query.trim()}” ✕
            </button>
          )}
          {families.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => updateSearch({ family: toggleInArray(families, f) })}
              className={`${LABEL_CLASS} tap-scale flex items-center gap-1.5 rounded-full bg-blush-deep px-3 py-1.5 text-ink`}
            >
              {f} ✕
            </button>
          ))}
          {brands.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => updateSearch({ brand: toggleInArray(brands, b) })}
              className={`${LABEL_CLASS} tap-scale flex items-center gap-1.5 rounded-full bg-blush-deep px-3 py-1.5 text-ink`}
            >
              {b} ✕
            </button>
          ))}
          {priceBucket && (
            <button
              type="button"
              onClick={() => updateSearch({ price: undefined })}
              className={`${LABEL_CLASS} tap-scale flex items-center gap-1.5 rounded-full bg-blush-deep px-3 py-1.5 text-ink`}
            >
              {PRICE_BUCKETS.find((b) => b.key === priceBucket)?.label} ✕
            </button>
          )}
          <button
            type="button"
            onClick={clearAll}
            className={`${LABEL_CLASS} text-accent hover:text-rose-deep`}
          >
            Clear all
          </button>
        </div>
      )}

      {items.length > 0 ? (
        <>
          <div
            ref={gridRef}
            className={`grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 ${isFetching ? "opacity-70" : ""}`}
          >
            {items.map((entry) => (
              <ProductTile key={entry.slug} entry={entry} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              aria-label="Pagination"
              className="mt-10 flex flex-col items-center gap-3 sm:mt-14"
            >
              <p className="text-xs text-muted">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                  aria-label="Previous page"
                  className="tap-scale flex size-9 items-center justify-center rounded-sm border border-line-strong text-ink transition-colors duration-(--duration-fast) hover:border-ink hover:bg-glass-strong disabled:pointer-events-none disabled:opacity-30"
                >
                  ‹
                </button>
                {pageWindow(page, totalPages).map((p, i) =>
                  p === null ? (
                    <span key={`gap-${i}`} className="px-1.5 text-sm text-muted">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => goToPage(p)}
                      aria-current={p === page ? "page" : undefined}
                      className={`tap-scale flex size-9 items-center justify-center rounded-sm text-sm transition-colors duration-(--duration-fast) ${
                        p === page ? "bg-rose text-black" : "text-ink-soft hover:bg-glass-strong"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page === totalPages}
                  aria-label="Next page"
                  className="tap-scale flex size-9 items-center justify-center rounded-sm border border-line-strong text-ink transition-colors duration-(--duration-fast) hover:border-ink hover:bg-glass-strong disabled:pointer-events-none disabled:opacity-30"
                >
                  ›
                </button>
              </div>
            </nav>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line-strong py-20 text-center">
          <p className="text-sm text-muted">No fragrances match your filters.</p>
          <button
            type="button"
            onClick={clearAll}
            className={`${LABEL_CLASS} text-accent hover:text-rose-deep`}
          >
            Clear filters
          </button>
        </div>
      )}

      {filterOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setFilterOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <aside
            className="glass-strong relative grid h-full w-full max-w-sm grid-rows-[auto_1fr_auto] divide-y divide-ink-soft/10"
            aria-label="Filters"
          >
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="font-display text-lg font-normal text-ink">Filters</span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setFilterOpen(false)}
                className="tap-scale flex size-10 items-center justify-center rounded-sm text-ink transition-colors duration-(--duration-fast) hover:bg-white/60"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-7 overflow-y-auto p-5">
              <div className="flex flex-col gap-3.5 border-b border-gray-100 pb-7">
                <span className="text-sm font-medium text-ink-soft">Family</span>
                <div className="flex max-h-56 flex-col overflow-y-auto pr-1">
                  {familyOptions.map(({ value, count }) => (
                    <CheckRow
                      key={value}
                      label={value}
                      count={count}
                      checked={families.includes(value)}
                      onToggle={() => updateSearch({ family: toggleInArray(families, value) })}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3.5 border-b border-gray-100 pb-7">
                <span className="text-sm font-medium text-ink-soft">Brand</span>
                <div className="flex max-h-56 flex-col overflow-y-auto pr-1">
                  {brandOptions.map(({ value, count }) => (
                    <CheckRow
                      key={value}
                      label={value}
                      count={count}
                      checked={brands.includes(value)}
                      onToggle={() => updateSearch({ brand: toggleInArray(brands, value) })}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3.5">
                <span className="text-sm font-medium text-ink-soft">Price</span>
                <div className="flex flex-wrap gap-2">
                  {PRICE_BUCKETS.map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() =>
                        updateSearch({ price: priceBucket === b.key ? undefined : b.key })
                      }
                      className={`${LABEL_CLASS} tap-scale rounded-full px-3.5 py-2 ${
                        priceBucket === b.key
                          ? "bg-rose text-black"
                          : "border border-line-strong text-ink-soft"
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-5">
              <button
                type="button"
                onClick={clearAll}
                className="flex-1 rounded-sm border border-line-strong px-4 py-3 text-sm text-ink"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                className="flex-1 rounded-sm bg-rose px-4 py-3 text-sm font-medium text-black"
              >
                Show {total} results
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
