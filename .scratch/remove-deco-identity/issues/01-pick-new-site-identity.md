# Pick new site identity

Type: grilling
Status: resolved

## Question

The site is currently registered under the shared deco template slug ("storefront" in `.env`'s `DECO_SITE_NAME`, "demo-storefront" in `wrangler.jsonc`'s `name`, `.deco/meta.gen.json`'s `site`, and `package.json`'s `name`/`generate:schema` script flag). What should the new, project-owned site slug be? Constraints: must be a valid Cloudflare Workers service name and a valid deco site slug (lowercase, hyphens). Decide the single canonical slug that will replace all four occurrences.

## Answer

New site slug: **`sillage`**. Matches the in-app brand already used throughout the UI (`SITE_NAME = "Sillage"` in `src/routes/__root.tsx`, footer trademark "© Sillage Parfums"). Replaces `storefront`/`demo-storefront` in `.env` (`DECO_SITE_NAME`), `wrangler.jsonc` (`name`), `.deco/meta.gen.json` (`site`), and `package.json` (`name` field + `generate:schema` script's `--site` flag) — this is what ticket 02 applies.
