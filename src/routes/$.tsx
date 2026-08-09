import { Fragment, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import Button from "~/components/ui/Button";
import IconButton from "~/components/ui/IconButton";
import ProductTile from "~/components/home/ProductTile";
import ProductHeroImage from "~/components/home/ProductHeroImage";
import type { CatalogEntry, ProductVariant } from "~/platform/catalog";
import {
  fetchProductDetail,
  fetchProductVariants,
  fetchRelatedProducts,
  PRODUCT_DETAIL_QUERY_KEY,
  PRODUCT_VARIANTS_QUERY_KEY,
  RELATED_PRODUCTS_QUERY_KEY,
  useProductDetail,
  useProductVariants,
  useRelatedProducts,
} from "~/platform/catalog/products.hooks";
import { useAddToCart } from "~/platform/cart";
import { useToggleWishlist, useWishlist } from "~/platform/wishlist";
import { useUser } from "~/platform/user";

const RELATED_LIMIT = 4;

export const Route = createFileRoute("/$")({
  component: CatchAllPage,
  loader: async ({ context, params }) => {
    const slug = (params._splat ?? "").split("/").filter(Boolean).pop() ?? "";
    // SSR prefetch, same reasoning/pattern as fragrance.tsx's loader (see
    // products.hooks.ts's comment above these fetch fns): individual
    // `.catch(() => {})` per call, not one around Promise.all, so a
    // transient failure degrades to the client-side fetch instead of
    // crashing the whole route.
    await Promise.all([
      context.queryClient
        .ensureQueryData({
          queryKey: PRODUCT_DETAIL_QUERY_KEY(slug),
          queryFn: () => fetchProductDetail(slug),
        })
        .catch(() => {}),
      context.queryClient
        .ensureQueryData({
          queryKey: PRODUCT_VARIANTS_QUERY_KEY(slug),
          queryFn: () => fetchProductVariants(slug),
        })
        .catch(() => {}),
      context.queryClient
        .ensureQueryData({
          queryKey: RELATED_PRODUCTS_QUERY_KEY(slug, RELATED_LIMIT),
          queryFn: () => fetchRelatedProducts(slug, RELATED_LIMIT),
        })
        .catch(() => {}),
    ]);
  },
});

function ProductPage({ entry, variants, related }: {
  entry: CatalogEntry;
  variants: ProductVariant[];
  related: CatalogEntry[];
}) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(undefined);
  // `variants` arrives async (its own query) after `entry` — pick a default
  // once it's actually loaded rather than at first render, when it's still [].
  const effectiveVariantId =
    selectedVariantId ?? variants.find((v) => v.stock > 0)?.id ?? variants[0]?.id;
  const selectedVariant = variants.find((v) => v.id === effectiveVariantId);
  const addToCart = useAddToCart();
  const { isInWishlist } = useWishlist();
  const toggleWishlist = useToggleWishlist();
  const { isAuthenticated } = useUser();
  const navigate = useNavigate();
  const inWishlist = isInWishlist(entry.id);

  return (
    <div className="pt-[90px] sm:pt-[110px]">
      <div className="grid grid-cols-1 gap-8 px-5 py-8 sm:grid-cols-2 sm:gap-14 sm:px-18 sm:py-14">
        <ProductHeroImage entry={entry} />

        <div className="sm:max-w-md">
          <div className="mb-2 font-display text-2xs font-medium tracking-(--tracking-label) text-accent uppercase">
            {entry.brand} · {entry.family}
          </div>
          <h1 className="font-display text-3xl font-light tracking-(--tracking-display) text-ink sm:text-4xl">
            {entry.name}
          </h1>
          <p className="mt-3 text-sm text-muted">{entry.notes}</p>
          <div className="mt-4 font-display text-2xl text-ink">
            ${(selectedVariant?.price ?? entry.price).toFixed(2)}
          </div>

          {variants.length > 0 && (
            <div className="mt-7">
              <div className="mb-2.5 font-display text-2xs font-medium tracking-(--tracking-label) text-ink uppercase">
                Size
              </div>
              <div className="flex gap-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    disabled={v.stock === 0}
                    onClick={() => setSelectedVariantId(v.id)}
                    className={`rounded-sm border px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                      v.id === effectiveVariantId
                        ? "border-rose bg-rose text-black"
                        : "border-line-strong text-ink"
                    }`}
                  >
                    {v.size}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-7 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="solid"
                size="md"
                className="w-full sm:w-auto"
                disabled={!selectedVariant || selectedVariant.stock === 0 || addToCart.isPending}
                onClick={() =>
                  selectedVariant &&
                  addToCart.mutate({ variantId: selectedVariant.id, quantity: 1 })
                }
              >
                {addToCart.isPending ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : !selectedVariant || selectedVariant.stock === 0 ? (
                  "Out of stock"
                ) : addToCart.isSuccess ? (
                  "Added!"
                ) : (
                  "Add to bag"
                )}
              </Button>
              <IconButton
                icon="favorite"
                label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
                active={inWishlist}
                filled={inWishlist}
                activeTone="rose"
                size="md"
                disabled={toggleWishlist.isPending}
                onClick={() => {
                  if (!isAuthenticated) {
                    navigate({ to: "/login" });
                    return;
                  }
                  toggleWishlist.mutate({ productID: entry.id, inWishlist });
                }}
              />
            </div>
            {addToCart.isError && (
              <p className="text-xs text-error">Couldn't add to bag. Please try again.</p>
            )}
          </div>

          {entry.description && (
            <p className="mt-7 text-sm leading-relaxed text-muted">{entry.description}</p>
          )}

          <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-6 text-sm">
            <dt className="text-muted">Rating</dt>
            <dd className="text-ink">
              {entry.rating > 0 ? `${entry.rating.toFixed(1)} / 5` : "—"}
              {entry.votes ? ` (${entry.votes.toLocaleString()} votes)` : ""}
            </dd>
            <dt className="text-muted">Family</dt>
            <dd className="text-ink">{entry.family}</dd>
            {entry.releaseYear && (
              <>
                <dt className="text-muted">Release year</dt>
                <dd className="text-ink">{entry.releaseYear}</dd>
              </>
            )}
            {entry.gender && (
              <>
                <dt className="text-muted">For</dt>
                <dd className="text-ink capitalize">{entry.gender}</dd>
              </>
            )}
          </dl>

          {entry.accords && entry.accords.length > 0 && (
            <div className="mt-7 border-t border-line pt-6">
              <div className="mb-3 font-display text-2xs font-medium tracking-(--tracking-label) text-ink uppercase">
                Accords
              </div>
              <ul className="flex flex-col gap-2">
                {entry.accords.map((accord) => (
                  <li key={accord.name} className="flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0 truncate text-ink">{accord.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-blush">
                      <div
                        className="h-full rounded-full bg-rose"
                        style={{ width: `${accord.strength}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {entry.notesByPosition && (
            <div className="mt-7 border-t border-line pt-6">
              <div className="mb-3 font-display text-2xs font-medium tracking-(--tracking-label) text-ink uppercase">
                Notes
              </div>
              <dl className="grid grid-cols-[80px_1fr] gap-y-2 text-sm">
                {(["top", "middle", "base"] as const).map((position) =>
                  entry.notesByPosition![position].length > 0 ? (
                    <Fragment key={position}>
                      <dt className="text-muted capitalize">{position}</dt>
                      <dd className="text-ink">{entry.notesByPosition![position].join(", ")}</dd>
                    </Fragment>
                  ) : null,
                )}
              </dl>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-14 sm:px-18">
        <h2 className="mb-5 font-display text-2xl font-normal tracking-(--tracking-display) text-ink">
          You might also like
        </h2>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 sm:gap-5">
          {related.map((r) => (
            <ProductTile key={r.slug} entry={r} />
          ))}
        </div>
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 pt-[90px] text-center sm:pt-[110px]">
      <h1 className="font-display text-4xl font-light text-ink">We couldn't find that page</h1>
      <p className="mt-3 max-w-sm text-sm text-muted">
        The page you're looking for doesn't exist in this demo catalog.
      </p>
      <div className="mt-7">
        <Button href="/" variant="solid" size="md">
          Back to Sillage
        </Button>
      </div>
    </div>
  );
}

function CatchAllPage() {
  const { _splat } = Route.useParams();
  const slug = (_splat ?? "").split("/").filter(Boolean).pop() ?? "";

  const { entry, isLoading: entryLoading } = useProductDetail(slug);
  const { variants } = useProductVariants(slug);
  const { items: related } = useRelatedProducts(slug, RELATED_LIMIT);

  if (entryLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center pt-[90px] sm:pt-[110px]">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return entry ? (
    <ProductPage entry={entry} variants={variants} related={related} />
  ) : (
    <NotFoundPage />
  );
}
