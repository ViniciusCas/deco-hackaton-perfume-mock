import { createFileRoute } from "@tanstack/react-router";
import { useUser } from "~/platform/user";
import { useWishlist } from "~/platform/wishlist";
import { useCatalog } from "~/platform/catalog";
import ProductTile from "~/components/home/ProductTile";
import Button from "~/components/ui/Button";

export const Route = createFileRoute("/wishlist")({
  component: WishlistPage,
});

function WishlistPage() {
  const { isAuthenticated, isLoading: userLoading } = useUser();
  const { wishlist, isLoading: wishlistLoading } = useWishlist();
  const { catalog, isLoading: catalogLoading } = useCatalog();

  if (userLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center pt-[90px] sm:pt-[110px]">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 pt-[90px] sm:pt-[110px]">
        <div className="frost w-full max-w-md rounded-lg p-8 text-center">
          <h1 className="mb-2 font-display text-2xl font-normal text-ink">You're not signed in</h1>
          <p className="mb-6 text-sm text-muted">Sign in to view your wishlist.</p>
          <Button href="/login" variant="solid" size="md">
            Go to sign in
          </Button>
        </div>
      </div>
    );
  }

  const items = catalog.filter((entry) => wishlist.productIds.includes(entry.id));
  const isLoading = wishlistLoading || catalogLoading;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-[90px] pb-14 sm:px-8 sm:pt-[110px]">
      <h1 className="mb-8 font-display text-4xl font-light text-ink">Your wishlist</h1>

      {isLoading ? (
        <span className="loading loading-spinner loading-lg" />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-6 py-24">
          <span className="font-display text-2xl font-light text-ink">
            Nothing saved here yet
          </span>
          <p className="max-w-sm text-center text-sm text-muted">
            Tap the heart on any fragrance to save it here for later.
          </p>
          <Button href="/fragrance" variant="outline" size="md">
            Browse fragrance
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 sm:gap-5">
          {items.map((entry) => (
            <ProductTile key={entry.slug} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
