import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import Button from "~/components/ui/Button";
import IconButton from "~/components/ui/IconButton";
import ProductTile from "~/components/home/ProductTile";
import ProductHeroImage from "~/components/home/ProductHeroImage";
import {
  type CatalogEntry,
  type ProductVariant,
  getCatalogServerFn,
  getProductBySlugServerFn,
  getProductVariantsBySlugServerFn,
} from "~/platform/catalog";
import { useAddToCart } from "~/platform/cart";
import { useToggleWishlist, useWishlist } from "~/platform/wishlist";
import { useUser } from "~/platform/user";

export const Route = createFileRoute("/$")({
  component: CatchAllPage,
  loader: async ({ params }) => {
    const slug = (params._splat ?? "").split("/").filter(Boolean).pop() ?? "";
    const [entry, catalog, variants] = await Promise.all([
      getProductBySlugServerFn({ data: slug }),
      getCatalogServerFn(),
      getProductVariantsBySlugServerFn({ data: slug }),
    ]);
    return { slug, entry, catalog, variants };
  },
});

function ProductPage({
  slug,
  entry,
  catalog,
  variants,
}: {
  slug: string;
  entry: CatalogEntry;
  catalog: CatalogEntry[];
  variants: ProductVariant[];
}) {
  const [selectedVariantId, setSelectedVariantId] = useState(
    variants.find((v) => v.stock > 0)?.id ?? variants[0]?.id,
  );
  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const related = catalog.filter((c) => c.slug !== slug).slice(0, 4);
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
                      v.id === selectedVariantId
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
            <dt className="text-muted">Notes</dt>
            <dd className="text-ink">{entry.notes}</dd>
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
  const { slug, entry, catalog, variants } = Route.useLoaderData();
  return entry ? (
    <ProductPage slug={slug} entry={entry} catalog={catalog} variants={variants} />
  ) : (
    <NotFoundPage />
  );
}
