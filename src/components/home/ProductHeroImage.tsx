import { useState } from "react";
import type { CatalogEntry } from "~/platform/catalog";

/**
 * PDP hero image — same real-image-with-letter-fallback treatment as
 * ProductTile, sized for the product detail layout instead of a grid tile.
 * Capped to a max width (rather than filling the whole grid column) so a
 * single product photo doesn't dominate the page.
 */
export default function ProductHeroImage({ entry }: { entry: CatalogEntry }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className="mx-auto flex aspect-[4/5] w-full max-w-sm items-center justify-center overflow-hidden rounded-md bg-blush-deep"
      aria-hidden="true"
    >
      {imgFailed ? (
        <span className="font-display text-9xl font-light text-violet-soft">
          {entry.name.slice(0, 1)}
        </span>
      ) : (
        <img
          src={entry.image}
          alt=""
          loading="eager"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}
