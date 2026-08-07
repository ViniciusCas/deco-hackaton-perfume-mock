export interface OrderItem {
  productId: string;
  variantId: string;
  title: string;
  size: string;
  unitPrice: { amount: number; currencyCode: string };
  quantity: number;
}

export interface Order {
  id: string;
  status: "placed" | "cancelled";
  items: OrderItem[];
  subtotal: { amount: number; currencyCode: string };
  total: { amount: number; currencyCode: string };
  shippingRecipient?: string;
  shippingStreetAddress?: string;
  shippingAddressLocality?: string;
  shippingAddressRegion?: string;
  shippingPostalCode?: string;
  shippingAddressCountry?: string;
  guestEmail?: string | null;
}

interface CheckoutShippingFields {
  shippingRecipient?: string;
  shippingStreetAddress?: string;
  shippingAddressLocality?: string;
  shippingAddressRegion?: string;
  shippingPostalCode?: string;
  shippingAddressCountry?: string;
}

/** Either a saved addressId (signed-in) or ad-hoc shipping fields; guestEmail required when unauthenticated. */
export type CheckoutInput = ({ addressId: string } | CheckoutShippingFields) & {
  guestEmail?: string;
};
