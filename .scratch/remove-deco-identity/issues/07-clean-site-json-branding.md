# Clean deco.cx branding out of site.json + setup.ts

Type: task
Status: resolved
Blocked by: 01

## Question

Ticket 04's audit found live deco.cx branding actually rendered on every real page: `.deco/blocks/site.json`'s `seo` block has `titleTemplate`/`descriptionTemplate: "%s | deco.cx"`, `description: "Build profitable websites with deco.cx"`, and a favicon/og-image hosted on `decoims.com`. Separately, `src/setup.ts`'s `createSiteSetup` call hardcodes `productionOrigins: ["https://www.demo-storefront.com.br", "https://demo-storefront.com.br"]`. Once the new site identity (ticket 01) is picked, replace this SEO copy with perfume-appropriate title/description templates, decide what to do about the `decoims.com`-hosted favicon/og-image (replace with a self-hosted asset, e.g. from `public/`, or leave as a placeholder — pick one), and update `productionOrigins` to the actual production domain(s) this project will use (or leave empty/placeholder if none exist yet).

## Answer

- **`.deco/blocks/site.json`'s `seo` block**: replaced deco.cx marketing copy with Sillage branding — `title: "Sillage"`, `titleTemplate`/`descriptionTemplate: "%s | Sillage"`, `description` now the same "composed in Grasse, aged six months" line already used in the homepage's editorial band (`src/routes/index.tsx`). Replaced the two `decoims.com`-hosted asset URLs with self-hosted `public/` assets: `favicon` → `/favicon.ico`, `image` (og:image) → `/image/hero.jpg` (the existing perfume hero shot — thematically correct as a social-preview image). **Caveat**: both are root-relative paths since no production domain exists yet (ticket 03) — social-media crawlers generally want an absolute URL for og:image, so once ticket 03 provisions a real domain, `image` should be upgraded to a fully-qualified URL.
- **`src/setup.ts`'s `productionOrigins`**: replaced the stale `demo-storefront.com.br` domains with `[]` plus a comment pointing at ticket 03. Confirmed safe from the framework source (`node_modules/@decocms/blocks/src/setup.ts` only calls `registerProductionOrigins` when the array is non-empty) — this option only strips a registered production origin's prefix from CMS-authored absolute URLs for staging/preview parity, so leaving it empty is a correct no-op, not a regression.
- Regenerated `.deco/blocks.gen.json` (`npm run generate:blocks`) — confirmed no `deco.cx` string survives in the generated output.
- **Bonus catch**: curled the running dev server's rendered HTML looking for `deco.cx`/`decoims.com` and found one more live one outside this ticket's named scope — `src/components/header/Menu.tsx`'s mobile menu had "Nossas lojas" (Our stores) and "Fale conosco" (Contact us) both hardcoded to `href="https://www.deco.cx"` (template placeholder links, never filled in). Fixed to `href="#"` since there's no real store-locator or contact page in this demo to link to instead.

Verified: `npm run typecheck` clean; dev server serves `/` with 200; curling the rendered HTML for `deco\.cx|decoims\.com` now returns **zero matches** (previously two). Remaining `deco.cx`/`decoims.com` strings in `src/` (`PoweredByDeco.tsx`, `CategoryBanner.tsx`, `Logos.tsx`, `ImageGallery.tsx`, `ShoppableBanner.tsx`) are all in framework-shipped example sections never imported by any route — dead code with default sample props, not rendered, same class as the orphaned `.deco/blocks` content ticket 05 removed. Noting as fog rather than scrubbing exhaustively — no user-facing effect and diminishing returns.
