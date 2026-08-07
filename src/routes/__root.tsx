import { createRootRouteWithContext } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { DecoRootLayout } from "@decocms/tanstack";
import { getUserServerFn, USER_QUERY_KEY } from "../platform/user";
import { CATALOG_QUERY_KEY, getCatalogServerFn } from "../platform/catalog";
import MinicartDrawer from "../components/minicart/MinicartDrawer";
import Header from "../sections/Header/Header";
import Footer from "../sections/Footer/Footer";
// @ts-ignore Vite ?url import
import appCss from "../styles/app.css?url";

const SITE_NAME = "Sillage";

const NAV_ITEMS = [
  { "@type": "SiteNavigationElement" as const, name: "Fragrance", url: "/fragrance" },
  { "@type": "SiteNavigationElement" as const, name: "Discovery", url: "/discovery" },
];

const FOOTER_LINKS = [
  {
    title: "Shop",
    href: "/",
    children: [
      { title: "All fragrance", href: "/" },
      { title: "Discovery", href: "/discovery" },
      { title: "Your bag", href: "/cart" },
    ],
  },
  {
    title: "Account",
    href: "/account",
    children: [
      { title: "My account", href: "/account" },
      { title: "Sign in", href: "/login" },
    ],
  },
];

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async ({ context }) => {
    // Cart is deliberately NOT prefetched here — sillage-api is a separate
    // origin the client calls directly with a localStorage-held token/cart-
    // session id, neither of which SSR has access to. Prefetching via a
    // client-only fetch during SSR would silently create an orphaned cart
    // row per guest page load. useCart() fetches client-side after
    // hydration instead. See .scratch/backend-api/issues/06-ssr-token-forwarding.md's
    // "New fog surfaced" note — guest cart SSR is still unresolved.
    const tasks: Promise<unknown>[] = [];
    if (!context.queryClient.getQueryData(USER_QUERY_KEY)) {
      tasks.push(
        getUserServerFn()
          .then((user) => context.queryClient.setQueryData(USER_QUERY_KEY, user))
          .catch(() => {}),
      );
    }
    if (!context.queryClient.getQueryData(CATALOG_QUERY_KEY)) {
      tasks.push(
        getCatalogServerFn()
          .then((catalog) => context.queryClient.setQueryData(CATALOG_QUERY_KEY, catalog))
          .catch(() => {}),
      );
    }
    await Promise.all(tasks);
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Sillage — Fine Fragrance" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Instrument+Sans:wght@400;500;600&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/image/sillage_logo.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
    ],
  }),
  component: RootLayout,
});

function RootLayout() {
  return (
    <DecoRootLayout lang="en" siteName={SITE_NAME}>
      {/*
        Header/Footer render here rather than around <StableOutlet /> —
        DecoRootLayout's <main><StableOutlet /></main> is fixed by the
        framework, so this is the only slot available without forking a
        shared package. Header is position:fixed (unaffected by DOM order);
        Footer, as the next sibling after <main>, lands in normal flow right
        below the page content, which is the placement that matters.
      */}
      <Header
        navItems={NAV_ITEMS}
        siteName={SITE_NAME}
        shippingNote="Complimentary shipping over $80 · Two samples with every order"
      />
      <MinicartDrawer />
      <Footer
        siteName={SITE_NAME}
        newsletterNote="New releases and refill restocks, once a month."
        links={FOOTER_LINKS}
        trademark={`© ${new Date().getFullYear()} ${SITE_NAME} Parfums`}
      />
    </DecoRootLayout>
  );
}
