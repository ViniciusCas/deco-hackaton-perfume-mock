export interface ProductAccord {
  name: string;
  /** 0-100, real weighted strength — see .scratch/normalize-notes-moods/map.md. */
  strength: number;
}

export interface ProductNotesByPosition {
  top: string[];
  middle: string[];
  base: string[];
}

export interface CatalogEntry {
  /** products.id — the real DB uuid, distinct from `slug`. Needed for wishlist (wishlist_items.product_id). */
  id: string;
  slug: string;
  name: string;
  brand: string;
  family: string;
  /** A computed 2-note summary from the real product_notes relation (list views) — not the old lossy single-string column. */
  notes: string;
  mood: string;
  price: number;
  rating: number;
  image: string;
  tag?: "New" | "Limited";
  /** PDP-only fields — populated by the sillage-api detail endpoint, undefined from list queries. */
  description?: string;
  votes?: number;
  releaseYear?: number;
  gender?: string;
  /** Full accord blend with real strength, ordered by strength desc — detail only. */
  accords?: ProductAccord[];
  /** Full top/middle/base note breakdown — detail only. */
  notesByPosition?: ProductNotesByPosition;
}

export interface ProductVariant {
  id: string;
  size: string;
  price: number;
  stock: number;
}
