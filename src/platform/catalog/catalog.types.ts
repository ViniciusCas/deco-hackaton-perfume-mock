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

export interface ProductVariant {
  id: string;
  size: string;
  price: number;
  stock: number;
}
