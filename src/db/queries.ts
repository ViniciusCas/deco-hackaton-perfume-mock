/**
 * Server-only catalog read — imports `getDb()` (which pulls in
 * `cloudflare:workers`), so this module must only ever be called from
 * `createServerFn` handlers, never imported client-side.
 *
 * Kept only for discovery.tsx's local keyword-scoring mock, which needs
 * the full catalog client-side and was explicitly deferred from the
 * sillage-api catalog migration — see
 * .scratch/backend-api/issues/14-catalog-cutover-remaining.md. Every other
 * catalog read (detail, variants, home-collections, list/search/filter) now
 * lives in sillage-api's src/routes/products.ts instead of here.
 */
import { desc, eq } from "drizzle-orm";
import { getDb } from "./client";
import { products, type products as ProductsTable } from "./schema";
import type { CatalogEntry } from "~/platform/catalog/catalog.types";

type ProductRow = typeof ProductsTable.$inferSelect;

function toCatalogEntry(row: ProductRow): CatalogEntry {
  return {
    id: row.id,
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
