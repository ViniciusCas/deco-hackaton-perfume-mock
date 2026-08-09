/**
 * One-time seed: perfumes.json -> Postgres `products` + `product_variants`.
 * Derivation logic (slug/family/notes/mood/tag/price) mirrors
 * src/mocks/catalog.ts exactly, per .scratch/postgres-backend/issues/05-seed-catalog.md,
 * so seeded rows match what the mock currently renders.
 *
 * Connects directly to RDS (not via Hyperdrive — that binding only exists
 * inside the Workers runtime), same as drizzle.config.ts.
 *
 * Run: npx tsx scripts/seed-catalog.ts
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import raw from "../src/mocks/perfumes.json" with { type: "json" };
import { products, productVariants, productAccords, productNotes } from "../src/db/schema";

config({ path: ".dev.vars" });

interface RawPerfume {
  id: string;
  name: string;
  brand: string;
  release_year: number;
  gender: string;
  accords: string;
  accords_strength: string;
  notes_top: string;
  notes_middle: string;
  notes_base: string;
  rating: number;
  votes: number;
  description: string;
  image_url: string;
}

const splitList = (value: string | undefined) =>
  (value ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

const titleCase = (value: string) => value.replace(/\b\w/g, (c) => c.toUpperCase());

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function priceFor(entry: RawPerfume): number {
  const popularity = Math.min(entry.votes, 30000) / 1500;
  const value = 58 + entry.rating * 15 + popularity;
  return Math.round(value / 2) * 2;
}

const usedSlugs = new Set<string>();

// 50 ml is the catalog price (matches the PDP's default-selected size);
// 30 ml/100 ml are derived multipliers, rounded to the nearest $2 like
// priceFor() does, since perfumes.json has no real per-size pricing.
const VARIANT_SIZES = [
  { size: "30 ml", multiplier: 0.7, stock: 60 },
  { size: "50 ml", multiplier: 1, stock: 40 },
  { size: "100 ml", multiplier: 1.7, stock: 25 },
];

/**
 * Full accord blend for a product, with real strength percentages —
 * previously discarded past the first 4 (see .scratch/normalize-notes-moods/map.md).
 * `accords`/`accords_strength` are parallel semicolon-delimited lists,
 * same order, same length in every row observed in perfumes.json; a
 * defensive length-mismatch clamp avoids inserting a name with no
 * corresponding strength if that ever isn't true.
 */
function buildAccordRows(entry: RawPerfume) {
  const names = splitList(entry.accords);
  const strengths = splitList(entry.accords_strength).map(Number);
  const count = Math.min(names.length, strengths.length);
  return names.slice(0, count).map((name, i) => ({
    productId: entry.id,
    name: titleCase(name),
    strength: strengths[i],
    sortOrder: i,
  }));
}

/** Full top/middle/base note breakdown — previously collapsed to one note
 * per product (see .scratch/normalize-notes-moods/map.md). */
function buildNoteRows(entry: RawPerfume) {
  const positions = [
    ["top", entry.notes_top],
    ["middle", entry.notes_middle],
    ["base", entry.notes_base],
  ] as const;
  return positions.flatMap(([position, value]) =>
    splitList(value).map((name, i) => ({
      productId: entry.id,
      name,
      position,
      sortOrder: i,
    })),
  );
}

function buildProductRow(entry: RawPerfume) {
  const accords = splitList(entry.accords);
  const notesTop = splitList(entry.notes_top);
  const notesMiddle = splitList(entry.notes_middle);
  const notesBase = splitList(entry.notes_base);

  const family = accords[0] ? titleCase(accords[0]) : `${entry.gender} fragrance`;
  const notes = [notesTop[0], notesMiddle[0] ?? notesBase[0]].filter(Boolean).join(" · ") || family;
  const mood = accords.slice(0, 4).join(" ");

  let slug = slugify(entry.name);
  if (!slug || usedSlugs.has(slug)) {
    slug = `${slug || "fragrance"}-${entry.id.slice(0, 6)}`;
  }
  usedSlugs.add(slug);

  // perfumes.json has source-data gaps — some rows carry "" instead of a
  // number for release_year (68 rows), rating/votes (60 rows each). None of
  // this is caught by RawPerfume's declared type. catalog.ts never noticed
  // because its only uses (`>= 2023` comparisons) coerce "" to 0 harmlessly;
  // Postgres integer/numeric columns need explicit nulls instead.
  const releaseYear = typeof entry.release_year === "number" ? entry.release_year : null;
  const rating = typeof entry.rating === "number" ? entry.rating : null;
  const votes = typeof entry.votes === "number" ? entry.votes : null;

  const tag: "New" | "Limited" | null =
    releaseYear !== null && releaseYear >= 2023
      ? "New"
      : rating !== null && rating >= 4.6 && votes !== null && votes >= 12000
        ? "Limited"
        : null;

  const price = priceFor({ ...entry, rating: rating ?? 0, votes: votes ?? 0 });

  return {
    id: entry.id,
    slug,
    name: entry.name,
    brand: entry.brand,
    family,
    notes,
    mood,
    description: entry.description || null,
    imageUrl: entry.image_url,
    releaseYear,
    gender: entry.gender,
    rating: rating !== null ? String(rating) : null,
    votes,
    tag,
    price: String(price),
    isActive: true,
  };
}

async function main() {
  const connectionString =
    process.env.DATABASE_URL ?? process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE;
  if (!connectionString) {
    throw new Error("Set DATABASE_URL (or ...HYPERDRIVE) in .dev.vars to run the seed script.");
  }

  const isLocalHost = /^postgres(ql)?:\/\/[^@]+@(localhost|127\.0\.0\.1)(:|\/)/.test(connectionString);
  const client = postgres(connectionString, { max: 1, ssl: isLocalHost ? false : "require" });
  const db = drizzle(client);

  const rawEntries = raw as RawPerfume[];
  const productRows = rawEntries.map(buildProductRow);

  console.log(`Seeding ${productRows.length} products...`);
  for (let i = 0; i < productRows.length; i += 50) {
    await db.insert(products).values(productRows.slice(i, i + 50)).onConflictDoNothing();
  }

  const variantRows = rawEntries.flatMap((entry) => {
    const rating = typeof entry.rating === "number" ? entry.rating : 0;
    const votes = typeof entry.votes === "number" ? entry.votes : 0;
    const price = priceFor({ ...entry, rating, votes });
    return VARIANT_SIZES.map(({ size, multiplier, stock }) => ({
      productId: entry.id,
      size,
      price: String(Math.round((price * multiplier) / 2) * 2),
      stock,
    }));
  });

  console.log(`Seeding ${variantRows.length} product variants...`);
  for (let i = 0; i < variantRows.length; i += 150) {
    await db
      .insert(productVariants)
      .values(variantRows.slice(i, i + 150))
      .onConflictDoNothing();
  }

  const accordRows = rawEntries.flatMap(buildAccordRows);
  console.log(`Seeding ${accordRows.length} product accords...`);
  for (let i = 0; i < accordRows.length; i += 150) {
    await db
      .insert(productAccords)
      .values(accordRows.slice(i, i + 150))
      .onConflictDoNothing();
  }

  const noteRows = rawEntries.flatMap(buildNoteRows);
  console.log(`Seeding ${noteRows.length} product notes...`);
  for (let i = 0; i < noteRows.length; i += 150) {
    await db
      .insert(productNotes)
      .values(noteRows.slice(i, i + 150))
      .onConflictDoNothing();
  }

  const [{ count: productCount }] = await client`select count(*)::int as count from products`;
  const [{ count: variantCount }] = await client`select count(*)::int as count from product_variants`;
  const [{ count: accordCount }] = await client`select count(*)::int as count from product_accords`;
  const [{ count: noteCount }] = await client`select count(*)::int as count from product_notes`;
  console.log(
    `Done. products=${productCount} product_variants=${variantCount} product_accords=${accordCount} product_notes=${noteCount}`,
  );

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
