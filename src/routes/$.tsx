import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import Button from "~/components/ui/Button";
import ProductTile from "~/components/home/ProductTile";
import ProductHeroImage from "~/components/home/ProductHeroImage";
import { type CatalogEntry, getCatalogServerFn, getProductBySlugServerFn } from "~/platform/catalog";

export const Route = createFileRoute("/$")({
  component: CatchAllPage,
  loader: async ({ params }) => {
    const slug = (params._splat ?? "").split("/").filter(Boolean).pop() ?? "";
    const [entry, catalog] = await Promise.all([
      getProductBySlugServerFn({ data: slug }),
      getCatalogServerFn(),
    ]);
    return { slug, entry, catalog };
  },
});

const SIZES = ["30 ml", "50 ml", "100 ml"];

function ProductPage({ slug, entry, catalog }: { slug: string; entry: CatalogEntry; catalog: CatalogEntry[] }) {
  const [size, setSize] = useState(SIZES[1]);
  const related = catalog.filter((c) => c.slug !== slug).slice(0, 4);

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
          <div className="mt-4 font-display text-2xl text-ink">${entry.price}</div>

          <div className="mt-7">
            <div className="mb-2.5 font-display text-2xs font-medium tracking-(--tracking-label) text-ink uppercase">
              Size
            </div>
            <div className="flex gap-2">
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  className={`rounded-sm border px-4 py-2.5 text-sm ${
                    s === size
                      ? "border-rose bg-rose text-black"
                      : "border-line-strong text-ink"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-2">
            <Button type="button" variant="solid" size="md" disabled className="w-full sm:w-auto">
              Add to bag — demo
            </Button>
            <p className="text-xs text-muted">
              This catalog is a design demo — nothing here is wired to real checkout.
            </p>
          </div>
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
  const { slug, entry, catalog } = Route.useLoaderData();
  return entry ? <ProductPage slug={slug} entry={entry} catalog={catalog} /> : <NotFoundPage />;
}
