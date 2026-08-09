## Destination

The repo reads as a standalone perfume storefront, not a fork of deco's `demo-storefront` template. The `@decocms/*` framework (blocks, sections, loaders, worker-entry, admin protocol) stays — it's what renders the app — but every deco-specific *identity* trace is gone: the shared "storefront"/"demo-storefront" site slug is replaced with one this project owns (fresh Cloudflare KV namespaces, fresh deploy identity, still hosted on deco.host/Cloudflare Workers via wrangler), leftover deco template demo content (unrelated `.deco/blocks/*.json` — Halloween, LinkTree, Cookie Consent, Campaign Timer, etc.) is gone if the audit confirms it's unused, and deco.cx marketing/migration narrative in README/AGENTS.md/TODO-MIGRATION.md is trimmed down to only the functional agent guidance this repo actually needs.

## Notes

- Domain: this is the `deco-hackaton-perfume-mock` repo (TanStack Start + React 19 + Cloudflare Workers, Shopify-shaped mock commerce backend, deco CMS admin protocol).
- Framework-removal (ripping out `@decocms/*` entirely) is explicitly **out of scope** for this map — see Out of scope below.
- `AGENTS.md`'s instructions on editing `.deco/blocks/*.json` (source of truth, gen-file regeneration flow) are functional, not deco marketing — keep that mechanism intact even while trimming narrative copy elsewhere in the same file.
- KV namespace ids in `wrangler.jsonc` are physical Cloudflare resources tied to deco's shared account — renaming the site slug alone does not create new ones; provisioning is real infra work, likely needs human-driven deco CLI auth.
- Tracker: GitHub Issues are disabled on this repo, so this map lives here in `.scratch/` (local-markdown tracker) instead of GitHub, despite `docs/agents/issue-tracker.md` saying GitHub. Revisit if Issues get enabled later.

## Decisions so far

- [Chart destination: keep framework, strip identity](map.md) — keep `@decocms/*` running the app; only strip deco-specific site identity/deploy config/demo content/narrative docs.
- [Hosting future](map.md) — stay on deco.host/Cloudflare Workers via wrangler, but under a freshly registered, user-owned site slug (new KV namespaces, new deploy identity) rather than the shared `storefront`/`demo-storefront` template name.
- [Block content audit stance](map.md) — audit `.deco/blocks/*.json` for real usage before deleting any of it; don't assume the demo-looking ones are dead weight.
- [Audit .deco/blocks content — perfume-live vs deco template demo](issues/04-audit-deco-blocks-content.md) — the whole visible site bypasses deco's CMS block-composition (Header/Footer/Hero/PDP/home are all hardcoded); classified 5 files as live framework/commerce config and 48 as orphaned deco template demo content safe to remove in ticket 05.
- [Remove orphaned deco template demo blocks](issues/05-remove-orphaned-blocks.md) — deleted all 48 orphaned files, regenerated `.deco/blocks.gen.json` (now exactly 5 blocks), typecheck clean, dev server confirmed serving 200 on `/`.
- [Pick new site identity](issues/01-pick-new-site-identity.md) — new slug is `sillage`, matching the in-app brand (`SITE_NAME = "Sillage"`); unblocks tickets 02, 03, 07.
- [Apply site identity rename across config](issues/02-apply-site-identity-rename.md) — `sillage` applied to `.env`, `wrangler.jsonc` (both `name` and the `vars.DECO_SITE_NAME` deploy var), regenerated `.deco/meta.gen.json`, `package.json`, `vite.config.ts`, three dead-code stragglers, and both lockfiles; typecheck clean, grep confirms only ticket 06/07's out-of-scope files remain.
- [Strip deco branding from README/AGENTS.md/TODO-MIGRATION.md](issues/06-trim-deco-narrative-docs.md) — rewrote `README.md` (dropped deco.cx marketing + dead migration-CLI section + dead links to nonexistent `MIGRATION_REPORT.md`/`MIGRATION_NEXT_STEPS.md`, fixed a stale "CMS resolver" claim and a MIT/Apache license mismatch); fixed the stale worker name in `.github/workflows/README.md`; `AGENTS.md` and `TODO-MIGRATION.md` reviewed and found already clean, left untouched.
- [Clean deco.cx branding out of site.json + setup.ts](issues/07-clean-site-json-branding.md) — `site.json`'s SEO block now says Sillage with self-hosted `/favicon.ico` + `/image/hero.jpg`; `setup.ts`'s `productionOrigins` emptied (safe no-op) pending ticket 03; also caught and fixed a live `deco.cx` placeholder link in the mobile menu. Rendered HTML now has zero `deco.cx`/`decoims.com` matches.
- [Provision new deploy identity on deco.host](issues/03-provision-new-deploy-identity.md) — done live with the user on their own Cloudflare account: fixed `account_id`, provisioned fresh `DECO_KV`/`SITES_KV`, discovered `dist/server/wrangler.json` as the real build-time deploy config, dropped deco's inaccessible `deco-otel-tail` tail-worker wiring, registered a `workers.dev` subdomain. Live at **https://sillage.sillage-hackaton.workers.dev**, verified zero deco.cx/decoims.com/demo-storefront traces in the rendered HTML.

## Not yet specified

- Now that a real production domain exists (`https://sillage.sillage-hackaton.workers.dev`), `site.json`'s `seo.image` (og:image, currently the root-relative `/image/hero.jpg`) could be upgraded to a fully-qualified URL — social crawlers generally prefer absolute URLs for og:image. Cosmetic, not blocking.
- Unused framework-shipped example `src/sections/*.tsx` components (`CategoryBanner.tsx`, `Logos.tsx`, `ImageGallery.tsx`, `ShoppableBanner.tsx`, `PoweredByDeco.tsx`) still carry default sample props pointing at `decoims.com`/`deco.cx` — never rendered by any route, so no user-facing effect, but the same class of dead template content as the `.deco/blocks` files ticket 05 removed, just at the component-defaults level. Low priority; revisit only if these sections are ever actually wired up.
- `docs/agents/issue-tracker.md` still tells agents "issues live as GitHub Issues... via gh CLI", but GitHub Issues are disabled on this repo (see Notes above) — needs updating once it's decided whether to re-enable Issues or permanently document the local-markdown fallback this map itself had to use.
- Whether to drop the `upstream` git remote (`deco-sites/demo-storefront`) and any GitHub template-fork linkage now that identity is diverging — depends on whether this project still wants to pull upstream template updates.
- LICENSE file currently a generic Apache 2.0 with no deco-specific text spotted — revisit only if anything later surfaces deco-specific legal/copyright notices elsewhere.

**Resolved by ticket 03, no longer fog:** the `deco-otel-tail` tail-worker wiring in `wrangler.jsonc` — removed entirely (see Decisions above), not merely trimmed.

## Out of scope

- Ripping out the `@decocms/*` framework (blocks/sections/loaders/apps-commerce/worker-entry) and re-platforming the UI as a plain non-deco app — ruled out when naming the destination; the framework stays.
