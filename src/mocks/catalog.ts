import raw from "./perfumes.json";

interface RawPerfume {
  id: string;
  name: string;
  brand: string;
  release_year: number;
  gender: string;
  accords: string;
  notes_top: string;
  notes_middle: string;
  notes_base: string;
  rating: number;
  votes: number;
  description: string;
  image_url: string;
}

export interface CatalogEntry {
  slug: string;
  name: string;
  brand: string;
  family: string;
  notes: string;
  mood: string;
  price: number;
  rating: number;
  image: string;
  tag?: "New" | "Limited";
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

/**
 * The real fragrance dataset (`perfumes.json`, Fragrantica-sourced) has no
 * price field, so a stable price is derived from rating/votes rather than
 * fabricated at random — same value every load for a given fragrance.
 */
function priceFor(entry: RawPerfume): number {
  const popularity = Math.min(entry.votes, 30000) / 1500;
  const value = 58 + entry.rating * 15 + popularity;
  return Math.round(value / 2) * 2;
}

const usedSlugs = new Set<string>();

function buildEntry(entry: RawPerfume): CatalogEntry {
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

  const tag: CatalogEntry["tag"] =
    entry.release_year >= 2023
      ? "New"
      : entry.rating >= 4.6 && entry.votes >= 12000
        ? "Limited"
        : undefined;

  return {
    slug,
    name: entry.name,
    brand: entry.brand,
    family,
    notes,
    mood,
    price: priceFor(entry),
    rating: entry.rating,
    image: entry.image_url,
    tag,
  };
}

const rawEntries = raw as RawPerfume[];
const pairs = rawEntries.map((entry) => ({ raw: entry, entry: buildEntry(entry) }));

export const CATALOG: CatalogEntry[] = [...pairs]
  .sort((a, b) => b.entry.rating - a.entry.rating)
  .map((p) => p.entry);

export const ARRIVALS: CatalogEntry[] = [...pairs]
  .sort((a, b) => b.raw.release_year - a.raw.release_year)
  .slice(0, 4)
  .map((p) => p.entry);

const arrivalSlugs = new Set(ARRIVALS.map((c) => c.slug));

export const BEST_SELLERS: CatalogEntry[] = [...pairs]
  .sort((a, b) => b.raw.votes - a.raw.votes)
  .map((p) => p.entry)
  .filter((c) => !arrivalSlugs.has(c.slug))
  .slice(0, 4);

export function findBySlug(slug: string): CatalogEntry | undefined {
  return CATALOG.find((c) => c.slug === slug);
}
