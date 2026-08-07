import type { HTMLWidget, ImageWidget } from "~/types/widgets";
import type { SiteNavigationElement } from "@decocms/apps-commerce/types";
import { Link } from "@tanstack/react-router";
import Alert from "../../components/header/Alert";
import Bag from "../../components/header/Bag";
import HeaderNav from "../../components/header/HeaderNav";
import Menu from "../../components/header/Menu";
import SearchOverlay from "../../components/header/SearchOverlay";
import SignIn from "../../components/header/SignIn";
import { type SearchbarProps } from "../../components/search/Searchbar/Form";
import Drawer from "../../components/ui/Drawer";
import Icon from "../../components/ui/Icon";
import Image from "../../components/ui/Image";
import Logo from "../../components/ui/Logo";
import { SEARCH_OVERLAY_ID, SIDEMENU_CONTAINER_ID, SIDEMENU_DRAWER_ID } from "../../constants";
import { useDevice } from "@decocms/blocks/sdk/useDevice";
import { type LoadingFallbackProps } from "~/types/deco";

export interface Logo {
  src: ImageWidget;
  alt: string;
  width?: number;
  height?: number;
}

export interface SectionProps {
  alerts?: HTMLWidget[];
  /**
   * @title Navigation items
   * @description Navigation items used both on mobile and desktop menus
   */
  navItems?: SiteNavigationElement[] | null;
  /**
   * @title Searchbar
   * @description Searchbar configuration
   */
  searchbar?: SearchbarProps;
  /** @title Logo */
  logo?: Logo;
  /**
   * @title Site name
   * @description Text wordmark shown when no logo image is set
   */
  siteName?: string;
  /**
   * @title Shipping note
   * @description Promo line shown in the utility bar above the header
   * @default "Frete grátis em compras acima de R$500."
   */
  shippingNote?: string;
  /**
   * @description Usefull for lazy loading hidden elements, like hamburguer menus etc
   * @hide true */
  loading?: "eager" | "lazy";
}

type Props = SectionProps;

const ICON_BUTTON_CLASS =
  "tap-scale flex size-11 items-center justify-center rounded-sm text-ink transition-colors duration-(--duration-fast) hover:bg-white/60";

function Wordmark({
  logo,
  siteName,
  className,
}: {
  logo?: Logo;
  siteName?: string;
  className: string;
}) {
  if (logo) {
    return (
      <Image
        src={logo.src}
        alt={logo.alt}
        width={logo.width ?? 96}
        height={logo.height ?? 26}
        className="h-6 w-auto object-contain"
        loading="eager"
      />
    );
  }
  if (!siteName) return null;
  return (
    <span className={`inline-flex items-center gap-[0.3em] ${className}`}>
      <Logo className="h-[0.85em] w-[0.85em] shrink-0" />
      {siteName}
    </span>
  );
}

const Desktop = ({ navItems, logo, siteName }: Props) => (
  <div className="grid h-19 grid-cols-[1fr_auto_1fr] items-center px-12">
    <HeaderNav navItems={navItems ?? []} />

    <Link to="/" aria-label="Home" className="justify-self-center">
      <Wordmark
        logo={logo}
        siteName={siteName}
        className="pl-[0.4em] font-display text-[22px] font-normal text-ink uppercase tracking-[0.4em]"
      />
    </Link>

    <div className="flex items-center justify-self-end gap-1">
      <label htmlFor={SEARCH_OVERLAY_ID} aria-label="Search" className={ICON_BUTTON_CLASS}>
        <Icon id="search" size={19} />
      </label>
      <SignIn />
      <Bag />
    </div>
  </div>
);

const Mobile = ({ logo, siteName }: Props) => (
  <div className="grid h-14 grid-cols-[44px_1fr_88px] items-center px-2">
    <label htmlFor={SIDEMENU_DRAWER_ID} aria-label="Open menu" className={ICON_BUTTON_CLASS}>
      <Icon id="menu" size={20} />
    </label>

    <Link to="/" aria-label="Home" className="justify-self-center text-center">
      <Wordmark
        logo={logo}
        siteName={siteName}
        className="pl-[0.34em] font-display text-[17px] font-normal text-ink uppercase tracking-[0.34em]"
      />
    </Link>

    <div className="flex items-center justify-self-end gap-1">
      <label htmlFor={SEARCH_OVERLAY_ID} aria-label="Search" className={ICON_BUTTON_CLASS}>
        <Icon id="search" size={19} />
      </label>
      <Bag />
    </div>
  </div>
);

function Header({
  alerts = [],
  logo,
  siteName = "Sillage",
  navItems,
  searchbar = { placeholder: "Search fragrances, brands, notes…" },
  loading,
  shippingNote = "Frete grátis em compras acima de R$500.",
  ...props
}: Props) {
  const device = useDevice();
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {shippingNote && (
        <div className="flex h-[34px] items-center justify-center bg-rose px-4 text-center font-display text-2xs font-medium tracking-(--tracking-label) text-black uppercase">
          {shippingNote}
        </div>
      )}

      {alerts.length > 0 && (
        <div className="glass-strong flex h-8 items-center justify-center text-2xs">
          <Alert alerts={alerts} />
        </div>
      )}

      <div className="frost border-b border-line">
        <Drawer
          id={SIDEMENU_DRAWER_ID}
          aside={
            <Drawer.Aside title="Menu" drawer={SIDEMENU_DRAWER_ID}>
              {loading === "lazy" ? (
                <div
                  id={SIDEMENU_CONTAINER_ID}
                  className="flex h-full items-center justify-center"
                  style={{ minWidth: "100vw" }}
                >
                  <span className="loading loading-spinner" />
                </div>
              ) : (
                <Menu navItems={navItems ?? []} />
              )}
            </Drawer.Aside>
          }
        />

        {device === "desktop" ? (
          <Desktop
            logo={logo}
            siteName={siteName}
            navItems={navItems}
            searchbar={searchbar}
            loading={loading}
            {...props}
          />
        ) : (
          <Mobile
            logo={logo}
            siteName={siteName}
            navItems={navItems}
            searchbar={searchbar}
            loading={loading}
            {...props}
          />
        )}

        <SearchOverlay searchbar={searchbar} />
      </div>
    </header>
  );
}

export const LoadingFallback = (props: LoadingFallbackProps<Props>) => (
  <Header {...(props as any)} loading="lazy" />
);

export default Header;

export const eager = true;
export const sync = true;
export const layout = true;
