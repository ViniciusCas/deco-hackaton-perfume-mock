# Implement the relational notes/accords migration

Type: task
Status: resolved

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

**Shipped**, in this order:

1. `src/db/schema.ts` — `product_accords` (name, strength, sortOrder,
   unique on product+name) and `product_notes` (name, position enum
   top/middle/base, sortOrder, unique on product+position+name). Purely
   additive — `products`/`product_variants` untouched.
2. `npm run db:generate` produced `drizzle/0001_clear_tarantula.sql`
   cleanly (no TTY-prompt rename-detection issue this time — new tables,
   nothing to misread as a rename). Applied via `psql` to local Docker
   Postgres first as a dry run, then to production RDS — both clean.
3. `scripts/seed-catalog.ts` extended with `buildAccordRows`/
   `buildNoteRows`, reading `perfumes.json`'s already-present
   `accords`/`accords_strength` (parallel lists, zipped) and
   `notes_top`/`notes_middle`/`notes_base`. Re-run locally first (354
   products → 2837 accords, 2168 note rows generated / 2166 inserted after
   `onConflictDoNothing` dedup — 2 rows were exact (product, position,
   name) duplicates in the source data), verified against real data
   (`le-male-le-parfum-jean-paul-gaultier`'s 9 accords and 6 notes matched
   the raw JSON exactly), then re-run against production with identical
   counts.
4. `sillage-api`'s duplicated schema hand-synced (its own commit,
   `c24205c`, pushed). `GET /v1/products/:slug` now returns `accords:
   [{name, strength}]` (sorted by original strength order) and
   `notesByPosition: {top, middle, base}`. List/related/home-collections/
   ids-batch endpoints compute a genuine 2-note summary via one batched
   query (not N+1) against `product_notes`, replacing the old `notes`
   column as the `notes` field in list responses — same field name, real
   data now. Deployed (`sillage-api` Version `d46053b1`).
5. Frontend: `CatalogEntry` gained `accords?`/`notesByPosition?` (detail-only,
   matching the existing `description`/`votes`/etc. pattern). PDP (`$.tsx`)
   replaced the single "Notes" `dl` row with two new sections — accords as
   strength bars (`width: {strength}%`), notes grouped by position. Website
   deployed (Version `814ba4d4`).
6. **Mid-implementation addition, not in the original ticket scope**: the
   user asked for the wishlist heart to render true red when active — it
   was using `text-ink` (near-black), easy to miss as a "wishlisted"
   signal. Added `IconButton`'s `activeTone` prop (`"ink"` default,
   `"rose"` → `text-error`, a real red) and wired it into both wishlist
   heart usages (`ProductTile`, PDP). Same deploy.

**Old `products.notes`/`products.mood` columns**: left in place, still
populated by the unchanged old derivation logic in `buildProductRow` —
**not dropped**, contrary to the map's original "drop once consumers
migrate" decision. Reason: `discovery.tsx` explicitly stays on the old
columns per the user's own earlier scoping instruction (not part of this
migration), so dropping them would break it. Revisit once/if `discovery.tsx`
itself migrates (tracked as fog on the backend-api map).

**Verification**: both repos typecheck and build clean. `sillage-api`'s
new endpoint shape confirmed against real production data (9 accords, 6
notes matching source exactly for a known product). Website verified via
`wrangler dev --remote` against the real built artifact — all 4 spot-checked
routes 200, no exceptions — then deployed and smoke-tested 200 across 8
routes. The PDP's new accords/notes sections were **not independently
confirmed rendering in a real browser** — same class of SSR-flash-then-hydrate
gap already accepted for the rest of the catalog migration (curl'd SSR
snapshot doesn't show client-hydrated content, but the mechanism is the
same one already user-confirmed working for `/fragrance`).
