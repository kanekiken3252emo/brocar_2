import {
  pgTable,
  uuid,
  text,
  serial,
  bigserial,
  numeric,
  integer,
  boolean,
  timestamp,
  bigint,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Suppliers table
export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  apiBaseUrl: text("api_base_url"),
  apiKey: text("api_key"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Price rules table
export const priceRules = pgTable("price_rules", {
  id: serial("id").primaryKey(),
  ruleName: text("rule_name").notNull(),
  brand: text("brand"),
  category: text("category"),
  pct: numeric("pct").notNull(), // percentage markup
  minMargin: numeric("min_margin"),
  active: boolean("active").default(true).notNull(),
});

// Products table
export const products = pgTable("products", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  article: text("article").notNull(),
  brand: text("brand"),
  name: text("name").notNull(),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  supplierPrice: numeric("supplier_price").notNull(),
  ourPrice: numeric("our_price").notNull(),
  stock: integer("stock").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Carts table
export const carts = pgTable("carts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id"),
  sessionId: text("session_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Cart items table
export const cartItems = pgTable("cart_items", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  cartId: bigint("cart_id", { mode: "number" })
    .references(() => carts.id)
    .notNull(),
  productId: bigint("product_id", { mode: "number" })
    .references(() => products.id)
    .notNull(),
  qty: integer("qty").default(1).notNull(),
});

// Orders table
export const orders = pgTable("orders", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id").notNull(),
  status: text("status").default("pending").notNull(),
  total: numeric("total").default("0").notNull(),
  paymentId: text("payment_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Order items table
export const orderItems = pgTable("order_items", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  orderId: bigint("order_id", { mode: "number" })
    .references(() => orders.id)
    .notNull(),
  productId: bigint("product_id", { mode: "number" }).references(
    () => products.id
  ),
  name: text("name").notNull(),
  article: text("article").notNull(),
  brand: text("brand"),
  qty: integer("qty").notNull(),
  price: numeric("price").notNull(),
});

// Relations
export const cartsRelations = relations(carts, ({ many }) => ({
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, {
    fields: [cartItems.cartId],
    references: [carts.id],
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const productsRelations = relations(products, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [products.supplierId],
    references: [suppliers.id],
  }),
}));




