import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import ProductTile from "~/components/home/ProductTile";
import { CATALOG, type CatalogEntry } from "~/mocks/catalog";
import { useEscapeKey } from "~/sdk/useEscapeKey";

interface FragranceSearch {
  q?: string;
}

export const Route = createFileRoute("/fragrance")({
  component: FragrancePage,
  validateSearch: (search: Record<string, unknown>): FragranceSearch => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
});

const LABEL_CLASS = "font-display text-2xs font-medium tracking-(--tracking-label) uppercase";

type PriceBucketKey = "under-80" | "80-110" | "110-130" | "130-plus";

const PRICE_BUCKETS: { key: PriceBucketKey; label: string; test: (price: number) => boolean }[] = [
  { key: "under-80", label: "Under $80", test: (p) => p < 80 },
  { key: "80-110", label: "$80 – $110", test: (p) => p >= 80 && p < 110 },
  { key: "110-130", label: "$110 – $130", test: (p) => p >= 110 && p < 130 },
  { key: "130-plus", label: "$130+", test: (p) => p >= 130 },
];

type SortKey = "recommended" | "price-asc" | "price-desc" | "name";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recommended", label: "Recommended" },
  { key: "price-asc", label: "Price: Low to High" },
  { key: "price-desc", label: "Price: High to Low" },
  { key: "name", label: "Name A–Z" },
];

function sortEntries(entries: CatalogEntry[], sort: SortKey): CatalogEntry[] {
  switch (sort) {
    case "price-asc":
      return [...entries].sort((a, b) => a.price - b.price);
    case "price-desc":
      return [...entries].sort((a, b) => b.price - a.price);
    case "name":
      return [...entries].sort((a, b) => a.name.localeCompare(b.name));
    default:
      return entries; // CATALOG is already rating-sorted
  }
}

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

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

const PAGE_SIZE = 24;

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
  const { q } = Route.useSearch();
  const [query, setQuery] = useState(q ?? "");
  const [families, setFamilies] = useState<Set<string>>(new Set());
  const [brands, setBrands] = useState<Set<string>>(new Set());
  const [priceBucket, setPriceBucket] = useState<PriceBucketKey | null>(null);
  const [sort, setSort] = useState<SortKey>("recommended");
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const gridRef = useRef<HTMLDivElement>(null);

  useEscapeKey(() => setFilterOpen(false));

  const familyOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of CATALOG) counts.set(c.family, (counts.get(c.family) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, []);

  const brandOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of CATALOG) counts.set(c.brand, (counts.get(c.brand) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, []);

  // The searchbar can send a fresh `q` while this page is already open
  // (same route, only the search param changes — no remount), so pick it
  // up whenever it changes rather than just on first render.
  useEffect(() => {
    setQuery(q ?? "");
  }, [q]);

  const filtered = useMemo(() => {
    const bucket = PRICE_BUCKETS.find((b) => b.key === priceBucket);
    const needle = query.trim().toLowerCase();
    const entries = CATALOG.filter((c) => {
      if (families.size > 0 && !families.has(c.family)) return false;
      if (brands.size > 0 && !brands.has(c.brand)) return false;
      if (bucket && !bucket.test(c.price)) return false;
      if (needle) {
        const haystack = `${c.name} ${c.brand} ${c.family} ${c.notes}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
    return sortEntries(entries, sort);
  }, [families, brands, priceBucket, sort, query]);

  // Filters/sort changed the result set — go back to page 1 rather than
  // stranding the visitor on a now out-of-range or mid-list page.
  useEffect(() => {
    setPage(1);
  }, [families, brands, priceBucket, sort, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const goToPage = (next: number) => {
    setPage(Math.min(Math.max(next, 1), totalPages));
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const activeCount = families.size + brands.size + (priceBucket ? 1 : 0) + (query.trim() ? 1 : 0);

  const clearAll = () => {
    setFamilies(new Set());
    setBrands(new Set());
    setPriceBucket(null);
    setQuery("");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-[90px] pb-14 sm:px-8 sm:pt-[110px]">
      <div className="mb-6 sm:mb-8">
        <div className={`${LABEL_CLASS} mb-3 text-accent`}>Full collection</div>
        <h1 className="font-display text-4xl font-light text-ink sm:text-5xl">Fragrance</h1>
        <p className="mt-3 max-w-xl text-sm text-muted sm:text-base">
          {query.trim()
            ? `${filtered.length} results for “${query.trim()}”`
            : `${CATALOG.length} fragrances, from everyday signatures to statement scents.`}
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
            onChange={(e) => setSort(e.target.value as SortKey)}
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
              onClick={() => setQuery("")}
              className={`${LABEL_CLASS} tap-scale flex items-center gap-1.5 rounded-full bg-blush-deep px-3 py-1.5 text-ink`}
            >
              “{query.trim()}” ✕
            </button>
          )}
          {[...families].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFamilies((prev) => toggleInSet(prev, f))}
              className={`${LABEL_CLASS} tap-scale flex items-center gap-1.5 rounded-full bg-blush-deep px-3 py-1.5 text-ink`}
            >
              {f} ✕
            </button>
          ))}
          {[...brands].map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBrands((prev) => toggleInSet(prev, b))}
              className={`${LABEL_CLASS} tap-scale flex items-center gap-1.5 rounded-full bg-blush-deep px-3 py-1.5 text-ink`}
            >
              {b} ✕
            </button>
          ))}
          {priceBucket && (
            <button
              type="button"
              onClick={() => setPriceBucket(null)}
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

      {filtered.length > 0 ? (
        <>
          <div ref={gridRef} className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
            {paginated.map((entry) => (
              <ProductTile key={entry.slug} entry={entry} />
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              aria-label="Pagination"
              className="mt-10 flex flex-col items-center gap-3 sm:mt-14"
            >
              <p className="text-xs text-muted">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                  className="tap-scale flex size-9 items-center justify-center rounded-sm border border-line-strong text-ink transition-colors duration-(--duration-fast) hover:border-ink hover:bg-glass-strong disabled:pointer-events-none disabled:opacity-30"
                >
                  ‹
                </button>
                {pageWindow(currentPage, totalPages).map((p, i) =>
                  p === null ? (
                    <span key={`gap-${i}`} className="px-1.5 text-sm text-muted">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => goToPage(p)}
                      aria-current={p === currentPage ? "page" : undefined}
                      className={`tap-scale flex size-9 items-center justify-center rounded-sm text-sm transition-colors duration-(--duration-fast) ${
                        p === currentPage
                          ? "bg-rose text-black"
                          : "text-ink-soft hover:bg-glass-strong"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
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
                  {familyOptions.map(([family, count]) => (
                    <CheckRow
                      key={family}
                      label={family}
                      count={count}
                      checked={families.has(family)}
                      onToggle={() => setFamilies((prev) => toggleInSet(prev, family))}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3.5 border-b border-gray-100 pb-7">
                <span className="text-sm font-medium text-ink-soft">Brand</span>
                <div className="flex max-h-56 flex-col overflow-y-auto pr-1">
                  {brandOptions.map(([brand, count]) => (
                    <CheckRow
                      key={brand}
                      label={brand}
                      count={count}
                      checked={brands.has(brand)}
                      onToggle={() => setBrands((prev) => toggleInSet(prev, brand))}
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
                      onClick={() => setPriceBucket((prev) => (prev === b.key ? null : b.key))}
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
                Show {filtered.length} results
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
