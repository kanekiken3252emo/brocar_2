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
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Profiles table (User information)
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // References auth.users
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  // Контактные данные для связи (заполняются при первом заказе)
  contactEmail: text("contact_email"),
  telegram: text("telegram"),
  whatsapp: text("whatsapp"),
  vk: text("vk"),
  maxMessenger: text("max_messenger"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

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
  // Импортированный каталог
  categorySlug: text("category_slug"),
  source: text("source").default("manual"), // 'berg' | 'rossko' | 'shate-m' | 'manual'
  carBrands: text("car_brands").array(), // ['BMW','AUDI',...] — марки авто из наименования
  // Характеристики для фасетных фильтров, извлечённые из наименования
  // (см. lib/catalog/attributes). Ключи зависят от категории, например для
  // engine-oils: { viscosity: "5W-40", oil_type: "Синтетическое", volume: "4 л" }.
  attributes: jsonb("attributes").$type<Record<string, string>>(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Остатки по складам/поставщикам — для импортированного каталога
export const productStocks = pgTable("product_stocks", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  productId: bigint("product_id", { mode: "number" })
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  supplierCode: text("supplier_code").notNull(),
  warehouseName: text("warehouse_name").notNull(),
  quantity: integer("quantity").default(0).notNull(),
  supplierPrice: numeric("supplier_price").notNull(),
  ourPrice: numeric("our_price").notNull(),
  deliveryDays: integer("delivery_days"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Кэш URL картинок товаров по (brand, article).
// Заполняется лениво при первом запросе картинки — см. lib/product-images.ts.
// image_url = NULL означает «уже искали, картинки нет» (negative cache),
// чтобы не дёргать ShATE-M повторно для отсутствующих позиций.
export const productImages = pgTable(
  "product_images",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    brand: text("brand").notNull(),
    article: text("article").notNull(),
    imageUrl: text("image_url"),
    source: text("source").default("shate-m").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    brandArticleIdx: uniqueIndex("product_images_brand_article_idx").on(
      t.brand,
      t.article
    ),
  })
);

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
  // Срок доставки позиции (дней) на момент добавления — нужен на оформлении,
  // чтобы для товаров «под заказ» (≥2 дней) показать согласие перед оплатой.
  // null = не задан (трактуем как «из наличия»).
  deliveryDays: integer("delivery_days"),
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

// Vehicles table (гараж пользователя)
export const vehicles = pgTable("vehicles", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id").notNull(),
  nickname: text("nickname"),
  brand: text("brand"),
  model: text("model"),
  year: integer("year"),
  vin: text("vin"),
  mileage: integer("mileage"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
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

export const productsRelations = relations(products, ({ one, many }) => ({
  supplier: one(suppliers, {
    fields: [products.supplierId],
    references: [suppliers.id],
  }),
  stocks: many(productStocks),
}));

export const productStocksRelations = relations(productStocks, ({ one }) => ({
  product: one(products, {
    fields: [productStocks.productId],
    references: [products.id],
  }),
}));




