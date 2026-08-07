# Implement the relational notes/accords migration

Type: task
Status: in-progress (claimed)

## Question

Build everything the map's Decisions so far pin down:
1. `product_accords`/`product_notes` tables in `src/db/schema.ts` (website
   repo, source of truth for migrations), migrated to production RDS via
   `db:generate` + manual `psql` apply.
2. Extend `scripts/seed-catalog.ts` to populate both tables from
   `perfumes.json`'s `accords`/`accords_strength`/`notes_top`/
   `notes_middle`/`notes_base` fields, run against production.
3. Hand-sync the same two tables into `sillage-api`'s duplicated schema
   copy (`sillage-api/src/db/schema.ts`).
4. `sillage-api`'s `/v1/products` (list) computes a top-2-notes display
   string via join; `/v1/products/:slug` (detail) returns the full accords
   (with strength) and notes (grouped by position) breakdown.
5. Frontend: PDP (`$.tsx`) renders the full accords/notes breakdown;
   `ProductTile`/list views use the new computed subtitle instead of the
   old `entry.notes` field.
6. Drop `products.notes`/`products.mood` once all consumers are migrated.

## Answer

_(pending)_
