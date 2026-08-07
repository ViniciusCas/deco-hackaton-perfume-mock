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
  /** PDP-only fields — populated by getProductBySlug, undefined from list queries (not selected there). */
  description?: string;
  votes?: number;
  releaseYear?: number;
  gender?: string;
}

export interface ProductVariant {
  id: string;
  size: string;
  price: number;
  stock: number;
}
