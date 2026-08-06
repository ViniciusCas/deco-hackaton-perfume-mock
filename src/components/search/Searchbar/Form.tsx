/**
 * Search bar — filters the catalog (prefetched into the query cache by
 * __root.tsx, see ~/platform/catalog) client-side; no per-keystroke network
 * call. Typing shows a live dropdown of the top matches by name/brand/
 * family/notes; Enter (or the search button) sends the full query to
 * /fragrance, which applies the same match as an additional filter
 * alongside family/brand/price.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { type CatalogEntry, useCatalog } from "~/platform/catalog";
import { SEARCHBAR_INPUT_FORM_ID, SEARCH_OVERLAY_ID } from "../../../constants";
import Icon from "../../ui/Icon";

export interface SearchbarProps {
  /**
   * @title Placeholder
   * @description Search bar default placeholder message
   * @default What are you looking for?
   */
  placeholder?: string;
}

const MAX_SUGGESTIONS = 6;

function matches(entry: CatalogEntry, needle: string): boolean {
  const haystack = `${entry.name} ${entry.brand} ${entry.family} ${entry.notes}`.toLowerCase();
  return haystack.includes(needle);
}

function closeSearchOverlay() {
  const toggle = document.getElementById(SEARCH_OVERLAY_ID) as HTMLInputElement | null;
  if (toggle) toggle.checked = false;
}

export default function Searchbar({ placeholder = "What are you looking for?" }: SearchbarProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { catalog } = useCatalog();

  // The overlay this searchbar lives in is a CSS-only show/hide (a checkbox
  // toggle) — this component mounts once, while it's still closed, so a
  // plain `autoFocus` prop fires before the overlay ever opens and never
  // fires again. Focus it for real each time the checkbox actually gets
  // checked. (The overlay is transform/opacity-only, not `visibility:
  // hidden`, so a direct focus() works — the animation-frame poll is just
  // defensive in case that ever changes.)
  useEffect(() => {
    const toggle = document.getElementById(SEARCH_OVERLAY_ID) as HTMLInputElement | null;
    const panel = toggle?.parentElement?.querySelector<HTMLElement>("[role='search']");
    if (!toggle) return;

    let raf = 0;
    const onChange = () => {
      if (!toggle.checked) return;
      let attempts = 0;
      const tryFocus = () => {
        attempts += 1;
        const visible = !panel || getComputedStyle(panel).visibility === "visible";
        if (visible || attempts > 30) {
          inputRef.current?.focus();
          return;
        }
        raf = requestAnimationFrame(tryFocus);
      };
      raf = requestAnimationFrame(tryFocus);
    };

    toggle.addEventListener("change", onChange);
    return () => {
      toggle.removeEventListener("change", onChange);
      cancelAnimationFrame(raf);
    };
  }, []);

  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return catalog.filter((entry) => matches(entry, needle)).slice(0, MAX_SUGGESTIONS);
  }, [catalog, query]);

  const goToResults = () => {
    const term = query.trim();
    if (!term) return;
    closeSearchOverlay();
    navigate({ to: "/fragrance", search: { q: term } });
  };

  return (
    <div className="w-full px-4 py-6">
      <form
        id={SEARCHBAR_INPUT_FORM_ID}
        className="flex items-center gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          goToResults();
        }}
      >
        <button type="submit" className="shrink-0 text-ink" aria-label="Search">
          <Icon id="search" size={19} />
        </button>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="grow border-0 border-b border-ink/15 bg-transparent pb-2 text-base text-ink outline-none placeholder:text-muted focus:border-ink/40"
          name="q"
          placeholder={placeholder}
          autoComplete="off"
        />
      </form>

      {suggestions.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1">
          {suggestions.map((entry) => (
            <li key={entry.slug}>
              <Link
                to="/$"
                params={{ _splat: entry.slug }}
                preload="intent"
                onClick={closeSearchOverlay}
                className="tap-scale flex items-center gap-3 rounded-sm px-2 py-2 transition-colors duration-(--duration-fast) hover:bg-white/60"
              >
                <div className="h-12 w-9 shrink-0 overflow-hidden rounded-xs bg-blush-deep">
                  <img
                    src={entry.image}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{entry.name}</div>
                  <div className="truncate text-xs text-muted">
                    {entry.brand} · {entry.family}
                  </div>
                </div>
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={goToResults}
              className="mt-1 w-full px-2 py-2 text-left text-sm text-accent hover:text-rose-deep"
            >
              See all results for “{query.trim()}”
            </button>
          </li>
        </ul>
      )}

      {query.trim() && suggestions.length === 0 && (
        <p className="mt-4 px-2 text-sm text-muted">No fragrances match “{query.trim()}”.</p>
      )}
    </div>
  );
}
