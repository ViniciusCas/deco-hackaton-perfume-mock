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
 *
 * Identity: the hand-rolled `customers` table from ticket 01 was replaced by
 * Better Auth's own `user`/`session`/`account`/`verification` tables — see
 * .scratch/postgres-backend/issues/02-auth-model.md. `user.id` is a text id
 * (Better Auth's default, not a uuid), so every FK that used to point at
 * `customers.id` now points at `user.id` instead.
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

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: text("name").notNull(),
  givenName: text("given_name"),
  familyName: text("family_name"),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  password: text("password"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

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

/**
 * Real per-product accord blend (family/mood, but weighted and complete —
 * see .scratch/normalize-notes-moods/map.md). Replaces `products.mood`,
 * which only ever kept the first 4 accords joined into a plain string with
 * no strength data. Source: perfumes.json's `accords`/`accords_strength`
 * parallel semicolon-delimited lists (already present in the seed data,
 * previously discarded past the first 4 by scripts/seed-catalog.ts).
 */
export const productAccords = pgTable(
  "product_accords",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    strength: integer("strength").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [unique().on(table.productId, table.name)],
);

/**
 * Real per-product note list, grouped by top/middle/base (a perfume's
 * scent stages). Replaces `products.notes`, which only ever kept the
 * first top note + first middle-or-base note joined into a one-line
 * string. Source: perfumes.json's `notes_top`/`notes_middle`/`notes_base`.
 */
export const notePosition = pgEnum("note_position", ["top", "middle", "base"]);

export const productNotes = pgTable(
  "product_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: notePosition("position").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [unique().on(table.productId, table.position, table.name)],
);

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

export const addresses = pgTable("addresses", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: text("customer_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
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
  customerId: text("customer_id").references(() => user.id, { onDelete: "set null" }),
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
    customerId: text("customer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
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
  customerId: text("customer_id").references(() => user.id, { onDelete: "set null" }),
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
  accords: many(productAccords),
  notes: many(productNotes),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));

export const productAccordsRelations = relations(productAccords, ({ one }) => ({
  product: one(products, { fields: [productAccords.productId], references: [products.id] }),
}));

export const productNotesRelations = relations(productNotes, ({ one }) => ({
  product: one(products, { fields: [productNotes.productId], references: [products.id] }),
}));

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  addresses: many(addresses),
  carts: many(carts),
  wishlistItems: many(wishlistItems),
  orders: many(orders),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  customer: one(user, { fields: [addresses.customerId], references: [user.id] }),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  customer: one(user, { fields: [carts.customerId], references: [user.id] }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  variant: one(productVariants, { fields: [cartItems.variantId], references: [productVariants.id] }),
}));

export const wishlistItemsRelations = relations(wishlistItems, ({ one }) => ({
  customer: one(user, { fields: [wishlistItems.customerId], references: [user.id] }),
  product: one(products, { fields: [wishlistItems.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(user, { fields: [orders.customerId], references: [user.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [orderItems.variantId], references: [productVariants.id] }),
}));
