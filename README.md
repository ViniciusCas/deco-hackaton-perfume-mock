# Sillage

A perfume storefront built on **TanStack Start + React 19 + Cloudflare Workers**, backed by a real commerce API (`sillage-api`, a separate Worker) and an AI-powered fragrance discovery chat.

This is a **site repo** — it consumes the [`@decocms/start`](https://www.npmjs.com/package/@decocms/start) framework (CMS bridge, admin protocol, worker entry, edge caching) and [`@decocms/apps`](https://www.npmjs.com/package/@decocms/apps) for framework plumbing. The storefront itself renders from `sillage-api`, not from deco's CMS block-composition system — see [How rendering works](#how-rendering-works).

## Stack

| Layer | Tech |
|---|---|
| Runtime | Cloudflare Workers (`nodejs_compat`) |
| Framework | TanStack Start / TanStack Router |
| UI | React 19 + React Compiler |
| Styles | Tailwind CSS v4 + DaisyUI |
| Build | Vite 7 |
| Data | TanStack Query + TanStack Store, server functions |
| Commerce | `sillage-api` — a separate Cloudflare Worker REST API (catalog, cart, checkout, wishlist, orders) |
| Database | Postgres (RDS) via Cloudflare Hyperdrive, Drizzle ORM — auth, cart/wishlist persistence, and discovery-agent data |
| Auth | `better-auth` (email/password) |
| Discovery agent | Cloudflare Agents SDK (Durable Objects) + Vercel AI SDK / OpenAI — the AI fragrance-finder chat |
| CMS | Deco admin protocol (via `@decocms/start`) — used for framework plumbing (admin/preview routes, site config) |
| Deploy | Wrangler (Cloudflare Workers) |

## Quick start

Requires Node 20+, `npm`, and Docker (for local Postgres).

```sh
docker compose up -d   # local Postgres on :5433
npm install
```

Create `.dev.vars` (gitignored) with the vars below, then apply the schema and start dev:

```sh
for f in drizzle/*.sql; do psql "$CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE" -f "$f"; done
npm run dev
```

Open `http://localhost:5173`.

`.dev.vars` needs:

| Var | What it's for |
|---|---|
| `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` | Local Postgres connection string (matches `docker-compose.yml`) |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `OPENAI_API_KEY` | Powers the discovery-chat agent's model calls |
| `VITE_SILLAGE_API_URL` | Optional override for the `sillage-api` base URL (defaults to the hosted instance) |

`drizzle-kit migrate`/`push` hang against this project's RDS instance — migrations are generated with `npm run db:generate` and applied by hand: `psql <connection-string> -f drizzle/<file>.sql`.

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
| `npm run db:generate` | Generate a Drizzle migration from `src/db/schema.ts` (codegen only — see note above on applying it) |
| `npm run db:studio` | Open Drizzle Studio against the DB in `.dev.vars` |
| `npm run types` | `wrangler types` — regenerate `Env` types from `wrangler.jsonc` bindings |
| `npm run clean` | Remove build artifacts/caches and reinstall |

## Project layout

```
src/
├── apps/                 # Site app composition (apps/site.ts)
├── routes/               # TanStack Router file routes
│   ├── index.tsx          #   home
│   ├── fragrance.tsx       #   catalog + filter drawer
│   ├── $.tsx               #   product detail (catch-all)
│   ├── discovery.tsx       #   full-page discovery chat
│   ├── cart.tsx / checkout.tsx / wishlist.tsx
│   ├── account.tsx / login.tsx
│   ├── insights.catalog-gaps.tsx  #   ops view of discovery-agent catalog-gap signals
│   └── deco/*              #   admin/preview routes (CMS block composition)
├── sections/              # CMS-registered sections (Header, Footer, Product, Newsletter, …)
├── components/             # UI components (header, minicart, product, search, discovery, ui, …)
├── agents/discovery/       # DiscoveryAgent — Cloudflare Agents SDK Durable Object (AI fragrance-finder chat)
├── db/                     # Drizzle schema, Postgres client (Hyperdrive), better-auth config, sillage-api SSR fetch helper
├── platform/                # Domain state — TanStack Query hooks + createServerFn actions
│   ├── cart/ / wishlist/ / orders/ / address/ / user/ / catalog/ / discovery/
│   └── sillage-api-client.ts  # client-side fetch helper for sillage-api
├── loaders/                # Site-local CMS loaders
├── actions/                # Site-local invoke handlers
├── hooks/                  # useCart, useUser, useWishlist
├── sdk/                     # signal, clx, debounce, deviceServer, logger
├── mocks/perfumes.json      # Seed data for sillage-api's own catalog DB — not read by this app
├── styles/app.css           # Tailwind v4 entry
├── setup.ts                 # Wires framework + apps + sections (called from worker entry)
├── setup/                   # Section-specific prop enrichment
├── cache-config.ts           # Edge cache profile overrides
├── server.ts                 # TanStack Start server entry
├── worker-entry.ts           # Cloudflare Worker entry: admin protocol, CSP, segmentation, caching
├── router.tsx                 # Router configuration
├── runtime.ts                 # Runtime helpers
└── context.ts                  # Site context

discovery-agent-tail/        # Tail Worker consuming DiscoveryAgent's observability events
drizzle/                    # Generated SQL migrations (applied by hand, see Quick start)
```

`.deco/blocks.gen.ts` / `.deco/sections.gen.ts` / `.deco/meta.gen.json` are generated — do not edit by hand (see `AGENTS.md`).

## How rendering works

The public storefront routes (`index.tsx`, `fragrance.tsx`, `discovery.tsx`, `cart.tsx`, `checkout.tsx`, `wishlist.tsx`, `login.tsx`, `account.tsx`, `insights.catalog-gaps.tsx`, and the catch-all `$.tsx` for product pages) are **hardcoded React fetching from `sillage-api`** (via `src/platform/*/​*.hooks.ts` + TanStack Query, SSR-prefetched in route loaders where relevant) — they do not resolve content from `.deco/blocks/`. The deco CMS block-composition system is only reachable through the admin/preview routes (`/deco/render`, `/deco/invoke.$`, `/deco/meta`), not the public site.

What deco framework plumbing *is* live:

1. A request hits `src/worker-entry.ts` → `createDecoWorkerEntry` (admin routes, edge cache, CSP, device segmentation).
2. Non-admin requests fall through to the TanStack Start server entry (`src/server.ts`) and the hardcoded routes above.
3. `src/setup.ts` reads `.deco/blocks/site.json` for SEO `<head>` meta, theme, and app registration — the only `.deco/blocks/*.json` file still in this repo (the rest were deco template demo content, removed).
4. Commerce loaders/actions register via `autoconfigApps`, available for any section that opts back into CMS-driven rendering, but nothing currently does.

## Discovery agent

`src/agents/discovery/` is a `DiscoveryAgent` — a Cloudflare Agents SDK Durable Object, one instance per conversation — that runs an AI chat guiding shoppers to a fragrance recommendation (ported from an earlier Python prototype, `sales-agent`). It:

- Calls the real catalog via `sillage-api` (`search_catalog` tool) and validates its own output against guardrails (`guardrails.ts`) before returning a turn.
- Persists its transcript and round state in its own per-Durable-Object SQLite (`this.sql`), and — for logged-in shoppers — a conversation summary row in Postgres (`discovery_conversations`).
- Surfaces catalog gaps (zero-result searches, rejected recommendations) as structured signals in Postgres (`discovery_catalog_gaps`), readable at `/insights/catalog-gaps` — grouped/counted so the same underlying gap across shoppers or retries reads as one signal, not N duplicates.

Exposed to the frontend two ways: the full-page `/discovery` route and a site-wide floating chat bubble (`DiscoveryBubble`, mounted in `__root.tsx`, hidden on `/insights/*`).

## Data fetching pattern

Domain state under `src/platform/<domain>/` follows a shared shape:

```
<domain>.types.ts     # platform-agnostic state shape
<domain>.actions.ts   # createServerFn wrappers (run on the worker) and/or sillage-api calls
<domain>.hooks.ts     # useQuery + useMutation
index.ts              # barrel
```

`src/routes/__root.tsx` prefetches cart + user in `beforeLoad` and seeds the QueryClient. The minicart drawer and discovery bubble are mounted at root.

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

Cloudflare Workers via Wrangler. Configuration is in `wrangler.jsonc` (entry: `src/worker-entry.ts`, worker name: `sillage`), including:

- A `HYPERDRIVE` binding to the production Postgres instance.
- A `DISCOVERY_AGENT` Durable Object binding (`DiscoveryAgent`) — new Agent classes need their own binding **and** a new `new_sqlite_classes` migration entry; never edit an existing migration tag.
- `tail_consumers` pointed at `sillage-discovery-tail` (observability for the Durable Object) — **requires the Cloudflare Workers Paid plan**; on a free-tier account, `wrangler deploy` fails at the final script-upload step with error 100150 even though asset upload succeeds. Remove `tail_consumers` to deploy on a free plan, or upgrade first.

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
