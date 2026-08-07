# Normalize perfume notes and moods (accords) into a relational model

## Destination

`products.notes` and `products.mood` — currently opaque, lossy strings
(`notes` keeps only the first top + first middle/base note; `mood` keeps
only the first 4 accords, discarding their strength percentages) — become
real relational data: every note (with its top/middle/base position) and
every accord (with its strength percentage) a product actually has, queryable
and displayable in full, not just a display-string fragment. The seed
source (`perfumes.json`) already carries this full data
(`accords`/`accords_strength` parallel semicolon-delimited lists,
`notes_top`/`notes_middle`/`notes_base`) — this is a schema + seed-script
fix recovering data already present, not new data sourcing.

## Notes

- Domain: same repo pair as the backend-api map (`deco-hackaton-perfume-mock`
  + `sillage-api`) — this migration touches both: the schema/seed lives in
  the website repo (`src/db/schema.ts`, `scripts/seed-catalog.ts`, applied
  to the shared production RDS), and `sillage-api` has its own **duplicated**
  schema copy (per the backend-api map's ticket 01 decision) that must be
  hand-synced to match.
- Current lossy transform, in `scripts/seed-catalog.ts`'s `buildProductRow`:
  ```ts
  const notes = [notesTop[0], notesMiddle[0] ?? notesBase[0]].filter(Boolean).join(" · ") || family;
  const mood = accords.slice(0, 4).join(" ");
  ```
- Source shape confirmed by reading `perfumes.json` directly, e.g.:
  `"accords": "warm spicy; vanilla; lavender; ..."`,
  `"accords_strength": "100; 80; 66; ..."` (parallel, same order),
  `"notes_top": "Cardamom"`, `"notes_middle": "Lavender; Iris"`,
  `"notes_base": "Vanilla; Oriental notes; Woodsy Notes"`.
- Production RDS already has 354 seeded product rows — this is a live-data
  migration, not a greenfield schema, so backfill/re-seed strategy matters.
- Raised as a "BE bug" alongside a batch of frontend fixes already
  shipped in this session (see the backend-api map for those) — user
  explicitly chose to scope this properly via a real design session rather
  than rush a blind migration, given it touches schema + two repos + live data.

## Decisions so far

- **Two separate relational tables**, not one combined table:
  `product_accords` (`product_id`, `name`, `strength` 0–100) and
  `product_notes` (`product_id`, `name`, `position`: top/middle/base, sort
  order within position) — accords are a weighted blend, notes are a
  categorized list, and the source data (`perfumes.json`) already keeps
  them as two separate concepts.
- **Migration**: wipe-and-reseed for the new tables only.
  `products`/`product_variants` (referenced by carts/orders/wishlist) stay
  untouched; the two new tables start empty and get populated by an
  extended `scripts/seed-catalog.ts` re-run against `perfumes.json`, which
  still has the full source data (`accords`/`accords_strength`,
  `notes_top`/`notes_middle`/`notes_base`).
- **Old lossy columns** (`products.notes`, `products.mood`) get **dropped
  once consumers migrate** — not kept permanently as a second source of
  truth. Migration order: add tables → seed → switch `sillage-api` and the
  frontend to read from them → drop the old columns.
- **List-view subtitle** (grid cards, search suggestions): computed
  server-side via a join/aggregate in `sillage-api` (e.g. top 2 notes by
  position) — no cached/duplicated display-string column.
- **PDP display**: the actual payoff of this migration — full accords
  breakdown with real strength percentages (a labeled bar/list) and the
  complete top/middle/base note groups, matching Fragrantica-style perfume
  sites. `entry.family` (a real, separate, already-correct column) is
  unaffected and stays as the brand/family eyebrow line as-is.
- **Migration tooling**: `db:generate` + manual `psql` apply, matching
  every other schema change against this RDS instance — `drizzle-kit
  migrate`/`push` are already known to hang against it (see the
  postgres-backend map's ticket 04).

## Not yet specified

_(none — decisions above fully pin the design; proceeding directly to
implementation tickets rather than further charting)_

## Out of scope

- Changing `products.family` or how it's derived — already a real,
  correct, separate column; not part of this migration.
