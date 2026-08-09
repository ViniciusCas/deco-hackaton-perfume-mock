# Remove orphaned deco template demo blocks

Type: task
Status: resolved
Blocked by: 04

## Question

Using the classification from ticket 04, delete the `.deco/blocks/*.json` files marked as orphaned deco template demo content, then regenerate the derived artifacts (`npm run generate:blocks` or equivalent) so `.deco/blocks.gen.json`/`.deco/blocks.gen.ts` reflect the removal. Confirm the site still builds/dev-serves cleanly afterward.

## Answer

Deleted all 48 files ticket 04 classified as orphaned deco template demo content from `.deco/blocks/`, keeping the 5 live ones (`site.json`, `Deco.json`, `deco-shopify.json`, `deco-htmx.json`, `deco-analytics.json`). Ran `npm run generate:blocks` — regenerated `.deco/blocks.gen.json` cleanly with exactly 5 blocks (0.0 MB, down from the full merged set), confirming no dangling references. `npm run typecheck` passes with no errors. Dev server (`vite dev`, already running) serves `/` with a 200 after the regen. No code changes were needed — nothing in `src/` ever referenced the removed blocks, confirming ticket 04's reachability analysis.
