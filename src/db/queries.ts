/**
 * Server-only catalog reads — imports `getDb()` (which pulls in
 * `cloudflare:workers`), so this module must only ever be called from
 * `createServerFn` handlers, never imported client-side. See
 * src/platform/catalog/catalog.actions.ts for the server-fn wrappers.
 */
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "./client";
import { productVariants, products, type products as ProductsTable } from "./schema";
import type { CatalogEntry, ProductVariant } from "~/platform/catalog/catalog.types";

type ProductRow = typeof ProductsTable.$inferSelect;

function toCatalogEntry(row: ProductRow): CatalogEntry {
  return {
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    family: row.family,
    notes: row.notes,
    mood: row.mood,
    price: Number(row.price),
    rating: row.rating !== null ? Number(row.rating) : 0,
    image: row.imageUrl,
    tag: (row.tag as CatalogEntry["tag"]) ?? undefined,
  };
}

export async function getCatalogEntries(): Promise<CatalogEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(desc(products.rating));
  return rows.map(toCatalogEntry);
}

export async function getProductBySlug(slug: string): Promise<CatalogEntry | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.isActive, true)))
    .limit(1);
  if (!row) return null;
  return {
    ...toCatalogEntry(row),
    description: row.description ?? undefined,
    votes: row.votes ?? undefined,
    releaseYear: row.releaseYear ?? undefined,
    gender: row.gender ?? undefined,
  };
}

/**
 * Variants (size/price/stock) for a product by slug — the actual `variantId`
 * needed to call sillage-api's POST /v1/cart/items. Not part of CatalogEntry
 * (list views never needed it before the cart cutover); PDP-only.
 */
export async function getProductVariantsBySlug(slug: string): Promise<ProductVariant[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: productVariants.id,
      size: productVariants.size,
      price: productVariants.price,
      stock: productVariants.stock,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(and(eq(products.slug, slug), eq(products.isActive, true)));

  return rows.map((r) => ({ id: r.id, size: r.size, price: Number(r.price), stock: r.stock }));
}

/**
 * Mirrors src/mocks/catalog.ts's derivation exactly: arrivals are the 4
 * newest by release year; best sellers are the top 4 by votes that aren't
 * already in arrivals. Fetches once and derives both in memory (catalog is
 * ~350 rows) rather than issuing two separate queries with an exclude list.
 */
export async function getHomeCollections(): Promise<{
  arrivals: CatalogEntry[];
  bestSellers: CatalogEntry[];
}> {
  const db = getDb();
  const rows = await db
    .select()
    .from(products)
    .where(eq(products.isActive, true));

  const byReleaseYear = [...rows].sort(
    (a, b) => (b.releaseYear ?? 0) - (a.releaseYear ?? 0),
  );
  const arrivals = byReleaseYear.slice(0, 4).map(toCatalogEntry);
  const arrivalSlugs = new Set(arrivals.map((a) => a.slug));

  const byVotes = [...rows].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
  const bestSellers = byVotes
    .map(toCatalogEntry)
    .filter((c) => !arrivalSlugs.has(c.slug))
    .slice(0, 4);

  return { arrivals, bestSellers };
}
