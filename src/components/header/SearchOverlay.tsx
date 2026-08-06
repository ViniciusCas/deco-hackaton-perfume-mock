import { SEARCH_OVERLAY_ID } from "../../constants";
import Searchbar, { type SearchbarProps } from "../search/Searchbar/Form";
import Icon from "../ui/Icon";

/**
 * Search panel — expands in place directly under the header's icon row (a
 * sibling within the header's own bordered bar, not an independently
 * `fixed`/top-0 layer with a manual offset guess), so it's always flush
 * against the header regardless of shipping-note/alerts height. Grid-rows
 * collapse (0fr -> 1fr) gives a smooth height animation without knowing the
 * content's height up front — same pattern as HeroSlideNav.
 */
export default function SearchOverlay({ searchbar }: { searchbar: SearchbarProps }) {
  return (
    <>
      <input
        type="checkbox"
        id={SEARCH_OVERLAY_ID}
        className="peer/search sr-only"
        aria-hidden="true"
      />

      <div
        role="search"
        className="grid grid-rows-[0fr] overflow-hidden bg-surface transition-[grid-template-rows] duration-(--duration-slow) ease-(--ease-out-soft) peer-checked/search:grid-rows-[1fr]"
      >
        <div className="min-h-0 overflow-hidden border-t border-line">
          <div className="mx-auto flex max-w-2xl items-start">
            <div className="min-w-0 flex-1">
              <Searchbar {...searchbar} />
            </div>
            <label
              htmlFor={SEARCH_OVERLAY_ID}
              aria-label="Close search"
              className="tap-scale mt-6 mr-4 flex size-10 shrink-0 items-center justify-center rounded-sm text-ink transition-colors duration-(--duration-fast) hover:bg-white/60"
            >
              <Icon id="close" size={18} />
            </label>
          </div>
        </div>
      </div>

      <label
        htmlFor={SEARCH_OVERLAY_ID}
        aria-label="Close search"
        className="fixed inset-0 z-40 bg-black/40 opacity-0 pointer-events-none transition-opacity duration-200 peer-checked/search:opacity-100 peer-checked/search:pointer-events-auto"
      />
    </>
  );
}
