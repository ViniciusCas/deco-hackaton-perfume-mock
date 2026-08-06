# Apply site identity rename across config

Type: task
Status: resolved
Blocked by: 01

## Question

Once the new slug is picked (ticket 01), apply it across `.env` (`DECO_SITE_NAME`), `wrangler.jsonc` (`name`), `.deco/meta.gen.json` (`site`), `package.json` (`name` field and the `generate:schema` script's `--site` flag), and any other literal occurrence of `storefront`/`demo-storefront` used as the site identity (not as a generic English word). Grep for the old slug after to confirm nothing was missed.

## Answer

Applied the `sillage` slug (ticket 01) across every literal site-identity occurrence:

- `.env` — `DECO_SITE_NAME=sillage`
- `wrangler.jsonc` — `"name": "sillage"` (worker name) and `"vars"."DECO_SITE_NAME": "sillage"` (production env var — a second occurrence beyond what the ticket named)
- `.deco/meta.gen.json` — regenerated via `npm run generate:schema --site sillage` (after updating that script's `--site` flag in `package.json`) rather than hand-edited, per AGENTS.md's "never hand-edit generated artifacts" rule
- `package.json` — `name`, `description`, `generate:schema` script's `--site` flag
- `vite.config.ts` — `DECO_SITE_NAME` fallback default
- `src/context.ts`, `src/types/deco.ts`, `src/components/ui/PoweredByDeco.tsx` — three more literal `"demo-storefront"` occurrences turned up by a full-repo grep (all dead/unreferenced code, but fixed for a fully clean grep sweep)
- `package-lock.json` (via `npm install --package-lock-only --offline`) and `bun.lock` (hand-edited; `bun install` didn't rewrite the workspace name) — kept lockfiles in sync

**Left alone (out of scope for this ticket, belongs to others):** `src/setup.ts`'s `productionOrigins` (ticket 07), `README.md` / `docs/agents/issue-tracker.md` / `.github/workflows/README.md` narrative prose (ticket 06), and `src/styles/app.css`'s comment describing the palette's `demo-storefront` provenance (historical/narrative, not live identity — leave for ticket 06 if desired).

Verified: `npm run typecheck` clean, dev server serves `/` with 200 after the regen, and a final repo-wide grep for `demo-storefront` returns only the five out-of-scope files above.
