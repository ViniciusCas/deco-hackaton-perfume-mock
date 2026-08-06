import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { CatalogEntry } from "~/platform/catalog";
import Tag from "~/components/ui/Tag";

/**
 * Product tile for the fragrance catalog (Home rails/grid, PDP "you might
 * like"). Images come from the real dataset (Fragrantica-sourced product
 * photography); a tinted initial panel is the fallback if a given image
 * fails to load, not the default state.
 */
export default function ProductTile({ entry }: { entry: CatalogEntry }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <Link to={`/${entry.slug}`} preload="intent" className="group flex shrink-0 flex-col gap-3">
      <div className="relative aspect-[372/498] w-full overflow-hidden rounded-sm bg-blush-deep">
        {imgFailed ? (
          <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
            <span className="font-display text-6xl font-light text-violet-soft">
              {entry.name.slice(0, 1)}
            </span>
          </div>
        ) : (
          <img
            src={entry.image}
            alt={entry.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition-transform duration-(--duration-slow) ease-(--ease-out-soft) group-hover:scale-[1.02]"
          />
        )}
        {entry.tag && (
          <div className="absolute top-3 left-3">
            <Tag tone="light">{entry.tag}</Tag>
          </div>
        )}
      </div>
      <div>
        <div className="font-display text-base font-medium text-ink">{entry.name}</div>
        <div className="mt-0.5 text-xs text-muted">{entry.notes}</div>
        <div className="mt-1.5 text-sm font-semibold text-ink">${entry.price}</div>
      </div>
    </Link>
  );
}
