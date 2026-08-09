# Audit .deco/blocks content — perfume-live vs deco template demo

Type: task
Status: resolved

## Question

`.deco/blocks/` has ~53 JSON files. Some are clearly deco template demo content unrelated to perfume (`Halloween.json`, `LinkTree - 01.json`, `Cookie Consent - 0{1,2,3}.json`, `Campaign Timer - 0{1,2}.json`, `Groovy Vibes.json`, `Lemonade.json`, `Fun.json`, `Neutral.json`, `Desktop.json`, `Mobile.json`, various `pages-Landing Page (...)` and `Preview ...` entries, etc.), others may be genuinely wired into the live perfume site (e.g. `Header.json`, `Footer.json`, `site.json`, `pages-home.json`). Cross-reference each file against `.deco/blocks.gen.json`, `.deco/sections.gen.ts`, `.deco/loaders.gen.ts`, and what the actual routes (`src/routes/*`) resolve at runtime, to classify every file as **live** (referenced/reachable from the perfume site) or **orphaned demo content** (template leftover, nothing reaches it). Record the classified list as the answer — this is what ticket 05 acts on.

## Answer

Classified all 53 files in `.deco/blocks/`. Method: `.deco/blocks.gen.json` merges *every* file mechanically (it's not a signal of liveness); actual reachability was traced through `src/setup.ts` (`createSiteSetup`/`createAdminSetup` read `site.json` + `.deco/blocks.gen`), `site.json`'s own `__resolveType` references, and every public route (`src/routes/*` — `index.tsx`, `discovery.tsx`, `cart.tsx`, `login.tsx`, `account.tsx`, `$.tsx`, `__root.tsx`). Finding: **the entire visible perfume site bypasses deco's CMS block-composition system** — Header/Footer/Hero/PDP/homepage are all hardcoded React with local mock data (`~/mocks/catalog`), not resolved from `.deco/blocks/*.json` props. Only `/deco/render`, `/deco/invoke.$`, `/deco/meta` (admin/preview-only routes) would ever reach the CMS page-composition blocks, and no real navigation links to them.

**Live (5 files — keep, framework/commerce config actually wired into boot/runtime):**
- `site.json` — root site config, read by `createAdminSetup`/`DecoRootLayout` for SEO `<head>` meta, theme, platform, route loaders (proxy/redirects). **Note:** its `seo` block has live deco.cx branding (`titleTemplate`/`descriptionTemplate`: `"%s | deco.cx"`, `description: "Build profitable websites with deco.cx"`, favicon/og-image hosted on `decoims.com`) that renders on every real page — see new ticket 07.
- `Deco.json` — active theme block (`site/sections/Theme/Theme.tsx`), referenced by `site.json`'s `theme.__resolveType: "Deco"`.
- `deco-shopify.json` — Shopify commerce app registration (store name, access tokens) — the real backend config.
- `deco-htmx.json` — htmx app registration, referenced by `site.json`'s `global` section.
- `deco-analytics.json` — analytics app registration, referenced by `site.json`'s `global` section.

**Orphaned deco template demo content (48 files — safe to remove in ticket 05):**
- CMS page compositions, none reachable from any real route: `pages-home.json`, `pages-Category%20Page-69217.json`, `pages-Landing%20Page%20(Accessories)-260333.json`, `pages-Landing%20Page%20(Home%20%26%20Living)-726977.json`, `pages-Landing%20Page%20(Kids)-181633.json`, `pages-Landing%20Page%20(Men)-177306.json`, `pages-Landing%20Page%20(Woman)-585575.json`, `pages-Search%20Page-514254.json`, `pages-offline-b9c52de8c7b3.json`, `pages-productpage-ce4850591828.json` (10)
- CMS versions of Header/Footer/nav, superseded by hardcoded props in `__root.tsx`: `Header.json`, `Footer.json`, `navbar.json` (3)
- Template section instances never rendered: `FAQ - 01/02/03.json`, `Cookie Consent - 01/02/03.json`, `Campaign Timer - 01/02.json`, `Category%20Banner%20-%2001.json`, `LinkTree%20-%2001.json`, `Shoppable%20Banner%20-%2001.json`, `Shortcuts%20-%2001.json` (11)
- Alternate Theme.tsx presets (template theme gallery), superseded by `Deco.json`: `Groovy%20Vibes.json`, `Lemonade.json`, `Fun.json`, `Neutral.json`, `Serene%20Coastline.json`, `Sunset%20Glow.json`, `Urban%20Chic.json`, `Halloween.json` (8)
- Audience/experiment matchers, only used by the orphaned page compositions: `Desktop.json`, `Mobile.json`, `Teste%20AB.json` (3)
- CMS commerce-loader instances for a page-composer PDP/PLP flow this app doesn't use (real PDP is `$.tsx` against `~/mocks/catalog`): `PDP%20Loader.json`, `PLP%20Loader.json`, `Product%20List%20Loader.json` (3)
- Admin editor's saved component-preview snapshots (isolated section dev only): `Preview%20%2Fsections%2FCategory%2FCategoryGrid.tsx.json`, `Preview%20%2Fsections%2FContent%2FImageSection.tsx.json`, `Preview%20%2Fsections%2FFooter.tsx.json`, `Preview%20%2Fsections%2FImages%2FCarousel.tsx.json`, `Preview%20%2Fsections%2FImages%2FImageGallery.tsx.json`, `Preview%20%2Fsections%2FItWorks.tsx.json`, `Preview%20%2Fsections%2FMiscellaneous%2FCampaignTimer.tsx.json`, `Preview%20%2Fsections%2FProduct%2FProductDetails.tsx.json`, `Preview%20site%2Fsections%2FAnimation%2FAnimation.tsx.json` (9)

5 + 48 = 53, accounted for.
