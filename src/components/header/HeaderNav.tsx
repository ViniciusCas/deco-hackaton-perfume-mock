import { Link } from "@tanstack/react-router";
import type { SiteNavigationElement } from "@decocms/apps-commerce/types";

export interface Props {
  navItems: SiteNavigationElement[];
}

/**
 * Flat top-level nav links, left of the header's centered wordmark — the
 * design's desktop header shows Fragrance/Discovery as plain text links,
 * not a floating pill with a hover mega-menu.
 */
export default function HeaderNav({ navItems }: Props) {
  return (
    <nav className="flex items-center gap-[30px]">
      {navItems.map((item) => (
        <Link
          key={item.url ?? item.name}
          to={item.url ?? "#"}
          preload="intent"
          className="font-display text-2xs font-medium tracking-(--tracking-label) text-ink uppercase transition-colors duration-(--duration-fast) hover:text-muted"
        >
          {item.name}
        </Link>
      ))}
    </nav>
  );
}
