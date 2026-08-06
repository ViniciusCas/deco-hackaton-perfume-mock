# Sillage

A perfume storefront demo built on **TanStack Start + React 19 + Cloudflare Workers**, with a mock Shopify-shaped commerce backend.

This is a **site repo** — it consumes the [`@decocms/start`](https://www.npmjs.com/package/@decocms/start) framework (CMS bridge, admin protocol, worker entry, edge caching) and [`@decocms/apps`](https://www.npmjs.com/package/@decocms/apps) (commerce loaders/actions). UI, sections, and routes live here.

## Stack

| Layer | Tech |
|---|---|
| Runtime | Cloudflare Workers (`nodejs_compat`) |
| Framework | TanStack Start / TanStack Router |
| UI | React 19 + React Compiler |
| Styles | Tailwind CSS v4 + DaisyUI |
| Build | Vite 7 |
| Data | TanStack Query + TanStack Store, server functions |
| Commerce | Shopify Storefront API (via `@decocms/apps/shopify`) |
| CMS | Deco admin protocol (via `@decocms/start`) — used for framework plumbing (admin/preview routes, site config); the public storefront itself renders from local mock data, see [How rendering works](#how-rendering-works) |
| Deploy | Wrangler (Cloudflare Workers) |

## Quick start

Requires Node 20+ and `npm`.

```sh
npm install
npm run dev
```

Open `http://localhost:5173`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run dev:clean` | Wipe Vite/Wrangler/TanStack caches and start fresh |
| `npm run build` | Generate blocks/schema/sections/loaders/routes, then `vite build` |
| `npm run preview` | Preview the production build locally |
| `npm run deploy` | `npm run build` then `wrangler deploy` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run format` / `format:check` | Prettier on `src/**/*.{ts,tsx}` |
| `npm run knip` / `knip:fix` | Find / auto-fix unused exports and files |
| `npm run tailwind:lint` / `tailwind:fix` | Lint/auto-fix Tailwind class usage |
| `npm run generate:*` | Re-run a single codegen step (blocks, schema, sections, loaders, routes, invoke) |

## Project layout

```
src/
├── apps/                 # Site app composition (apps/site.ts)
├── routes/               # TanStack Router file routes (__root, $, index, deco/*, account, login)
├── sections/             # CMS-registered sections (Header, Footer, Product, Newsletter, …)
├── components/           # UI components (header, minicart, product, search, ui, …)
├── platform/             # Domain state — TanStack Query hooks + createServerFn actions
│   ├── cart/             #   cart.{types,actions,hooks,shopify}.ts
│   ├── user/
│   └── wishlist/
├── loaders/              # Site-local CMS loaders (user, wishlist)
├── actions/              # Site-local invoke handlers (wishlist/submit, shipping/simulate)
├── hooks/                # useCart, useUser, useWishlist
├── sdk/                  # signal, clx, debounce, deviceServer, logger
├── mocks/                # Local perfume catalog data the public routes render from
├── styles/app.css        # Tailwind v4 entry
├── setup.ts              # Wires framework + apps + sections (called from worker entry)
├── setup/                # Section-specific prop enrichment
├── cache-config.ts       # Edge cache profile overrides
├── server.ts             # TanStack Start server entry
├── worker-entry.ts       # Cloudflare Worker entry: admin protocol, CSP, segmentation, caching
├── router.tsx            # Router configuration
├── runtime.ts            # Runtime helpers
└── context.ts             # Site context
```

`.deco/blocks.gen.ts` / `.deco/sections.gen.ts` / `.deco/meta.gen.json` are generated — do not edit by hand (see `AGENTS.md`).

## How rendering works

The public storefront routes (`index.tsx`, `discovery.tsx`, `cart.tsx`, `login.tsx`, `account.tsx`, and the catch-all `$.tsx` for product pages) are **hardcoded React reading from `src/mocks/catalog.ts`** — they do not resolve content from `.deco/blocks/`. The deco CMS block-composition system is only reachable through the admin/preview routes (`/deco/render`, `/deco/invoke.$`, `/deco/meta`), not the public site.

What deco framework plumbing *is* live:

1. A request hits `src/worker-entry.ts` → `createDecoWorkerEntry` (admin routes, edge cache, CSP, device segmentation).
2. Non-admin requests fall through to the TanStack Start server entry (`src/server.ts`) and the hardcoded routes above.
3. `src/setup.ts` reads `.deco/blocks/site.json` for SEO `<head>` meta, theme, and app registration (Shopify, htmx, analytics) — the only `.deco/blocks/*.json` files still in this repo (the rest were deco template demo content, removed).
4. Commerce loaders/actions register via `@decocms/apps-shopify` and `autoconfigApps`, available for any section that opts back into CMS-driven rendering, but nothing currently does.

## Data fetching pattern

Domain state (cart, user, wishlist) follows a single pattern under `src/platform/<domain>/`:

```
<domain>.types.ts     # platform-agnostic state shape
<domain>.actions.ts   # createServerFn wrappers (run on the worker)
<domain>.hooks.ts     # useQuery + useMutation
<domain>.shopify.ts   # adapter: Shopify response → state shape
index.ts              # barrel
```

`src/routes/__root.tsx` prefetches cart + user in `beforeLoad` and seeds the QueryClient. The minicart drawer is mounted at root and driven by the `useCart()` hook.

For navigation, use `<Link from="@tanstack/react-router" preload="intent">` on internal links — never plain `<a href>`.

## Edge caching

The worker entry applies Cloudflare edge cache profiles (defined in `@decocms/start/sdk/cacheHeaders`):

| URL pattern | Profile | Edge TTL |
|---|---|---|
| `/` | static | 1 day |
| `*/p` | product | 5 min |
| `/s`, `?q=` | search | 60s |
| `/cart`, `/checkout` | private | none |
| Everything else | listing | 2 min |

Override per-route in `src/cache-config.ts`.

## Deployment

Cloudflare Workers via Wrangler. Configuration is in `wrangler.jsonc` (entry: `src/worker-entry.ts`, worker name: `sillage`).

CI/CD is automatic (see [`.github/workflows/README.md`](./.github/workflows/README.md)):

- **Per-PR previews** — the Cloudflare **Workers Builds** GitHub App builds each PR and posts a sticky comment with the Commit/Branch preview URLs.
- **`deploy.yml`** — on push to `main`, runs `wrangler deploy` with `BUILD_HASH` injected.

Required repo secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

To deploy manually from your machine:

```sh
npm run deploy
```

For Argo CD / Kubernetes deployment manifests see `deploy/`.

## Follow-up work

See `TODO-MIGRATION.md` for the open cleanup checklist and canonical patterns to follow (Props grouping, skeleton scoping, `window.STOREFRONT.*` migration, etc.).

## Framework reference

This repo runs on the deco CMS framework (`@decocms/start`, `@decocms/apps`) for its admin protocol, worker entry, and edge caching:

- [deco.cx docs](https://www.deco.cx/docs/en/overview)
- Framework source: [`@decocms/start`](https://github.com/decocms/deco-start), [`@decocms/apps`](https://github.com/decocms/apps-start)

## License

Apache 2.0 — see `LICENSE`.
