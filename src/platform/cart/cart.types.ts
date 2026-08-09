export interface CartItemPrice {
  amount: number;
  currencyCode: string;
}

export interface CartItem {
  /** Cart line ID — use for update/remove operations. */
  itemId: string;
  /** Variant ID — what was added. */
  variantId: string;
  productId: string;
  slug: string;
  title: string;
  size: string;
  image?: string;
  price: CartItemPrice;
  quantity: number;
}

export interface CartState {
  id: string | null;
  sessionToken: string | null;
  items: CartItem[];
  subtotal: CartItemPrice;
  total: CartItemPrice;
  totalQuantity: number;
}

export const EMPTY_CART: CartState = {
  id: null,
  sessionToken: null,
  items: [],
  subtotal: { amount: 0, currencyCode: "USD" },
  total: { amount: 0, currencyCode: "USD" },
  totalQuantity: 0,
};
