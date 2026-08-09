import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { CatalogEntry } from "~/platform/catalog";
import { useToggleWishlist, useWishlist } from "~/platform/wishlist";
import { useUser } from "~/platform/user";
import Tag from "~/components/ui/Tag";
import IconButton from "~/components/ui/IconButton";

/**
 * Product tile for the fragrance catalog (Home rails/grid, PDP "you might
 * like"). Images come from the real dataset (Fragrantica-sourced product
 * photography); a tinted initial panel is the fallback if a given image
 * fails to load, not the default state.
 */
export default function ProductTile({ entry }: { entry: CatalogEntry }) {
  const [imgFailed, setImgFailed] = useState(false);
  const { isInWishlist } = useWishlist();
  const toggle = useToggleWishlist();
  const { isAuthenticated } = useUser();
  const navigate = useNavigate();

  const inWishlist = isInWishlist(entry.id);
  const pending = toggle.isPending && toggle.variables?.productID === entry.id;

  return (
    // The wishlist button is a sibling of the Link, not nested inside it —
    // a <button> inside an <a> is invalid HTML content model and click
    // handling (preventDefault/stopPropagation) on it isn't reliable across
    // browsers/touch. Both share this relative wrapper so the button can
    // still sit visually on top of the image via absolute positioning.
    <div className="group relative flex shrink-0 flex-col gap-3">
      <Link to={`/${entry.slug}`} preload="intent" className="flex shrink-0 flex-col gap-3">
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
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-ink">${entry.price}</span>
            {entry.rating > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted">
                <span aria-hidden="true" className="text-accent">
                  ★
                </span>
                {entry.rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="absolute top-3 right-3">
        <IconButton
          icon="favorite"
          label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
          active={inWishlist}
          filled={inWishlist}
          activeTone="rose"
          disabled={pending}
          onClick={() => {
            if (!isAuthenticated) {
              navigate({ to: "/login" });
              return;
            }
            toggle.mutate({ productID: entry.id, inWishlist });
          }}
        />
      </div>
    </div>
  );
}
