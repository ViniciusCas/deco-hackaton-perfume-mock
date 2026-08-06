/**
 * Drizzle schema — decided in .scratch/postgres-backend/issues/01-schema-design.md.
 * DB client: src/db/client.ts. Migrations: npm run db:generate, then apply the
 * generated SQL manually via psql (see .scratch/postgres-backend/issues/04-drizzle-setup.md
 * — drizzle-kit's own migrate/push CLI hangs against this RDS instance).
 *
 * Key decisions baked in here (see that ticket for the full reasoning):
 * - `products.id` is the UUID already present in perfumes.json, not a generated one.
 * - Catalog derived fields (slug/family/notes/mood/tag) and price are real stored
 *   columns, not recomputed at query time.
 * - Carts and orders both support guests (`customerId` nullable) as well as
 *   signed-in customers; wishlists require an account.
 * - `orders`/`order_items` snapshot title/size/price/shipping address at purchase
 *   time so later catalog or address-book edits never rewrite order history.
 * - `products.isActive` is a soft-delete flag — rows are never hard-deleted so
 *   past cart/order references never dangle.
 */
import {
  boolean,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const orderStatus = pgEnum("order_status", ["placed", "cancelled"]);

export const products = pgTable("products", {
  id: uuid("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  family: text("family").notNull(),
  notes: text("notes").notNull(),
  mood: text("mood").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),
  releaseYear: integer("release_year"),
  gender: text("gender"),
  rating: numeric("rating", { precision: 2, scale: 1 }),
  votes: integer("votes"),
  tag: text("tag", { enum: ["New", "Limited"] }),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    size: text("size").notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    stock: integer("stock").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.productId, table.size)],
);

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  givenName: text("given_name"),
  familyName: text("family_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const addresses = pgTable("addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  label: text("label"),
  recipient: text("recipient"),
  streetAddress: text("street_address"),
  addressLocality: text("address_locality"),
  addressRegion: text("address_region"),
  postalCode: text("postal_code"),
  addressCountry: text("address_country"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Guest carts are identified by `sessionToken` (issued as a cookie); signing
// in attaches `customerId` to the same row rather than merging two carts.
export const carts = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  sessionToken: text("session_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id),
    quantity: integer("quantity").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.cartId, table.variantId)],
);

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.customerId, table.productId)],
);

// customerId nullable + guestEmail covers guest checkout; shipping fields are
// a snapshot (not an addresses FK) so guest orders — which have no address
// book — and later address-book edits both work the same way.
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  guestEmail: text("guest_email"),
  status: orderStatus("status").notNull().default("placed"),
  shippingRecipient: text("shipping_recipient"),
  shippingStreetAddress: text("shipping_street_address"),
  shippingAddressLocality: text("shipping_address_locality"),
  shippingAddressRegion: text("shipping_address_region"),
  shippingPostalCode: text("shipping_postal_code"),
  shippingAddressCountry: text("shipping_address_country"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  currencyCode: text("currency_code").notNull().default("USD"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id),
  variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
  titleSnapshot: text("title_snapshot").notNull(),
  sizeSnapshot: text("size_snapshot").notNull(),
  unitPriceSnapshot: numeric("unit_price_snapshot", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productsRelations = relations(products, ({ many }) => ({
  variants: many(productVariants),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  addresses: many(addresses),
  carts: many(carts),
  wishlistItems: many(wishlistItems),
  orders: many(orders),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  customer: one(customers, { fields: [addresses.customerId], references: [customers.id] }),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  customer: one(customers, { fields: [carts.customerId], references: [customers.id] }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  variant: one(productVariants, { fields: [cartItems.variantId], references: [productVariants.id] }),
}));

export const wishlistItemsRelations = relations(wishlistItems, ({ one }) => ({
  customer: one(customers, { fields: [wishlistItems.customerId], references: [customers.id] }),
  product: one(products, { fields: [wishlistItems.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [orderItems.variantId], references: [productVariants.id] }),
}));
