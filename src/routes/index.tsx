import { createFileRoute, Link } from "@tanstack/react-router";
import Icon, { type AvailableIcons } from "~/components/ui/Icon";
import Button from "~/components/ui/Button";
import ProductTile from "~/components/home/ProductTile";
import { getHomeCollectionsServerFn } from "~/platform/catalog";

export const Route = createFileRoute("/")({
  component: HomePage,
  loader: () => getHomeCollectionsServerFn(),
});

const NOTE_CHIPS = ["Floral", "Amber", "Woody", "Citrus", "Musk"];

const PERKS: { icon: AvailableIcons; label: string }[] = [
  { icon: "local_shipping", label: "Free over $80" },
  { icon: "favorite", label: "2 free samples" },
  { icon: "sell", label: "Refill program" },
];

function HomePage() {
  const { arrivals: ARRIVALS, bestSellers: BEST_SELLERS } = Route.useLoaderData();

  return (
    <div className="pt-[90px] sm:pt-[110px]">
      {/* Hero — the newest arrival's real product photo, with a gradient
          for text legibility over the image (mobile-style full-bleed hero,
          matching the design's mobile treatment at all breakpoints). */}
      <section className="relative flex min-h-[560px] flex-col justify-end overflow-hidden px-5 pb-8 sm:min-h-[640px] sm:justify-center sm:px-18 sm:pb-0">
        <img
          src="/image/hero.jpg"
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgb(2 1 34 / 5%) 0%, rgb(2 1 34 / 15%) 45%, rgb(2 1 34 / 72%) 100%)",
          }}
        />
        <div className="relative max-w-md text-white sm:max-w-lg">
          <div className="mb-2.5 font-display text-2xs font-medium tracking-(--tracking-label) text-white/90 uppercase sm:mb-5">
            New — Eau de Parfum
          </div>
          <h1 className="font-display text-4xl leading-[1.02] font-light tracking-(--tracking-display) sm:text-7xl">
            {ARRIVALS[0].name.split(" ")[0]}
            <br />
            {ARRIVALS[0].name.split(" ").slice(1).join(" ")}
          </h1>
          <p className="mt-2.5 max-w-70 text-sm leading-relaxed opacity-90 sm:mt-5 sm:max-w-md sm:text-[17px]">
            {ARRIVALS[0].notes} — a {ARRIVALS[0].family.toLowerCase()} composed to be noticed at
            close range.
          </p>
          <div className="mt-4.5 sm:mt-8">
            <Button href={`/${ARRIVALS[0].slug}`} variant="solid" size="md">
              Shop the launch
            </Button>
          </div>
        </div>
      </section>

      {/* Note chips */}
      <section className="scrollbar-none flex gap-2 overflow-x-auto px-5 py-6 sm:px-18">
        {NOTE_CHIPS.map((chip) => (
          <span
            key={chip}
            className="frost shrink-0 rounded-sm px-4 py-2.5 font-display text-2xs font-medium tracking-(--tracking-label) text-ink uppercase"
          >
            {chip}
          </span>
        ))}
      </section>

      {/* New arrivals */}
      <section className="px-5 py-7 sm:px-18 sm:py-14">
        <div className="mb-4 flex items-end justify-between gap-2 sm:mb-6">
          <h2 className="font-display text-2xl font-normal tracking-(--tracking-display) text-ink sm:text-4xl">
            New arrivals
          </h2>
          <Link
            to="/fragrance"
            className="font-display text-2xs font-medium tracking-(--tracking-label) text-accent uppercase hover:text-rose-deep"
          >
            See all
          </Link>
        </div>
        <div className="scrollbar-none flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 sm:gap-5 sm:overflow-visible">
          {ARRIVALS.map((entry) => (
            <div key={entry.slug} className="w-43 shrink-0 sm:w-auto">
              <ProductTile entry={entry} />
            </div>
          ))}
        </div>
      </section>

      {/* Editorial band */}
      <section className="bg-rose px-6 py-11 text-black sm:px-18 sm:py-22">
        <div className="mb-3.5 font-display text-2xs font-medium tracking-(--tracking-label) text-ink uppercase sm:mb-5.5">
          The house
        </div>
        <p className="max-w-xl font-display text-2xl leading-snug font-light tracking-(--tracking-display) sm:text-4xl">
          Every fragrance is composed in Grasse and aged six months before it leaves us.
        </p>
      </section>

      {/* Best sellers */}
      <section className="px-5 py-8 sm:px-18 sm:py-19">
        <h2 className="mb-4 font-display text-2xl font-normal tracking-(--tracking-display) text-ink sm:mb-6 sm:text-4xl">
          Best sellers
        </h2>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 sm:gap-5">
          {BEST_SELLERS.map((entry) => (
            <ProductTile key={entry.slug} entry={entry} />
          ))}
        </div>
      </section>

      {/* Quiz banner */}
      <section className="mx-5 rounded-lg bg-gold-deep/45 px-5.5 py-7 sm:mx-18 sm:px-13 sm:py-16">
        <h2 className="mb-2 font-display text-xl font-normal text-ink sm:text-3xl">
          Find your signature
        </h2>
        <p className="mb-4.5 max-w-md text-sm text-muted sm:mb-7 sm:text-base">
          A short conversation, one scent profile, three vials worth trying.
        </p>
        <Button href="/discovery" variant="solid" size="md">
          Talk to our fragrance expert
        </Button>
      </section>

      {/* Perks */}
      {/* <section className="px-5 py-10 sm:px-18">
        <div className="grid grid-cols-3 gap-2.5 text-center sm:gap-5">
          {PERKS.map(({ icon, label }) => (
            <div key={label} className="rounded-sm bg-surface px-2 py-4.5 sm:py-6.5">
              <Icon id={icon} size={20} className="mx-auto text-accent" />
              <div className="mt-2 font-display text-2xs font-medium tracking-(--tracking-label) text-ink uppercase">
                {label}
              </div>
            </div>
          ))}
        </div>
      </section> */}
    </div>
  );
}
