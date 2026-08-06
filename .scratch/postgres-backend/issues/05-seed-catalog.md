# Seed the catalog table from perfumes.json

Type: task
Status: resolved
Blocked by: 01, 04

## Question

Write a one-time seed script that reads `src/mocks/perfumes.json`, applies the same derivation logic `src/mocks/catalog.ts` currently does at load time (slug generation/uniqueness, family/notes/mood/tag/price derivation — per [Design the Postgres schema](01-schema-design.md)'s decision on what's stored vs. computed), and inserts the rows into the real `products` table via Drizzle. Run it against `sillage-hackaton-db` and confirm row count/spot-check a few records.

## Answer

`scripts/seed-catalog.ts` (`npx tsx scripts/seed-catalog.ts`) reads `perfumes.json`, replicates `catalog.ts`'s exact derivation logic (`splitList`/`titleCase`/`slugify`/`priceFor`/tag rules) for `products`, and additionally derives 3 `product_variants` per product (30/50/100 ml, with 50 ml = the catalog price and 30/100 ml as rounded multipliers — perfumes.json has no real per-size pricing). Connects directly to RDS (not via Hyperdrive — that binding doesn't exist outside the Workers runtime), same pattern as `drizzle.config.ts`. Idempotent via `onConflictDoNothing()` on `products.id`/`(product_id, size)`.

**Result: 354 products, 1062 variants** (354 × 3), confirmed via `select count(*)`.

**Data-quality bug caught along the way**: `perfumes.json` has source gaps `catalog.ts` never surfaced — 68 rows have `release_year: ""` instead of a number, 60 rows have `rating`/`votes: ""`. `catalog.ts`'s only use of these (`>= 2023` style comparisons) coerces `""` to `0` harmlessly in JS, so the mock never broke — but a Postgres `integer`/`numeric` column rejects `""` outright (`invalid input syntax`). Fixed by normalizing to `null` for the DB columns and `0` for the price-formula inputs (matching what the JS coercion effectively did), rather than silently miscounting or crashing. Spot-checked: 60 products have `rating IS NULL`, 68 have `release_year IS NULL`, matching the source gap count exactly.
