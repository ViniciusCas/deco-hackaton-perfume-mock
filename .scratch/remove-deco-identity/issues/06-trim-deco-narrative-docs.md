# Strip deco branding from README/AGENTS.md/TODO-MIGRATION.md

Type: task
Status: resolved

## Question

`README.md` currently opens with deco.cx marketing copy and a full "Migrating a Deco Fresh storefront to this stack" section describing deco's migration CLI; `TODO-MIGRATION.md` documents that migration's leftover TODOs; `AGENTS.md` mixes functional agent guidance (the `.deco/blocks/*.json` editing/regeneration flow — keep this, see map Notes) with deco.cx narrative framing; `.github/workflows/README.md` may also carry deco-specific narrative. Rewrite these to describe the repo as a standalone perfume storefront project, trimming deco.cx marketing/migration narrative while preserving the functional parts (stack description, `.deco/blocks` editing instructions, build/dev/typecheck commands).

## Answer

Read all four files before touching anything, and only rewrote what actually needed it:

- **`README.md`** — fully rewritten. Dropped: the deco.cx opening line ("A deco.cx storefront..."), the entire ~75-line "Migrating a Deco Fresh storefront to this stack" section (deco's migration CLI marketing/instructions — irrelevant now that this repo already *is* the migrated output), and the "Migration artifacts" section, which pointed at `MIGRATION_REPORT.md`/`MIGRATION_NEXT_STEPS.md` — **neither file exists in this repo**, so that was a dead link regardless of branding. Replaced with a pointer to the real, still-relevant `TODO-MIGRATION.md`. Also fixed two accuracy bugs found while rewriting: "How rendering works" claimed the catch-all route resolves pages via the CMS resolver — false since ticket 04's audit (it's hardcoded mock data); rewrote that section to describe what's actually live. And the License section said "MIT" while `LICENSE` is actually Apache 2.0 — fixed to match. Kept: stack table, scripts, project layout, data-fetching pattern, edge caching, deployment — all still accurate — and the deco.cx docs/Discord links under a "Framework reference" heading (legitimate reference material, not marketing, since the framework stays per the map's destination).
- **`AGENTS.md`** — reviewed in full, left unchanged. Contrary to the ticket's assumption, it carries no deco.cx marketing narrative — it's already just functional guidance (stack one-liner, `.deco/blocks` editing/regeneration mechanics, code conventions, agent-skill pointers). Nothing to trim.
- **`TODO-MIGRATION.md`** — reviewed in full, left unchanged. It's a legitimate, still-open engineering TODO list (Props grouping, skeleton scoping, `window.STOREFRONT.*` migration, etc.) with zero deco.cx branding — "migration" here refers to the historical Fresh→TanStack Start move, used only as context for why the patterns exist.
- **`.github/workflows/README.md`** — one-line fix: dropped the stale `demo-storefront` worker-name reference (now `sillage`, matching ticket 02's rename) and the now-irrelevant "rename it in your fork" advice.

Verified: `npm run typecheck` clean, dev server still serves `/` with 200, and a grep for deco.cx marketing phrases ("Build profitable websites", "deco.cx storefront", "migration CLI", "Fresh...Deno") across all four files returns nothing.

**New fog surfaced, not fixed here (out of this ticket's scope):** `docs/agents/issue-tracker.md` still tells agents "issues live as GitHub Issues... via gh CLI" — but this session discovered GitHub Issues are disabled on this repo (see map Notes), so that guidance is now factually wrong. Worth a future ticket to update it once it's decided whether to re-enable Issues or permanently document the local-markdown fallback.
