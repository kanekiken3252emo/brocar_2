-- BroCar Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ngfooubrlgdhaqihihci/editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  api_base_url TEXT,
  api_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Price rules table
CREATE TABLE IF NOT EXISTS price_rules (
  id SERIAL PRIMARY KEY,
  rule_name TEXT NOT NULL,
  brand TEXT,
  category TEXT,
  pct NUMERIC NOT NULL,
  min_margin NUMERIC,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  article TEXT NOT NULL,
  brand TEXT,
  name TEXT NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  supplier_price NUMERIC NOT NULL,
  our_price NUMERIC NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Carts table
CREATE TABLE IF NOT EXISTS carts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cart items table
CREATE TABLE IF NOT EXISTS cart_items (
  id BIGSERIAL PRIMARY KEY,
  cart_id BIGINT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL DEFAULT 1
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total NUMERIC NOT NULL DEFAULT 0,
  payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id),
  name TEXT NOT NULL,
  article TEXT NOT NULL,
  brand TEXT,
  qty INTEGER NOT NULL,
  price NUMERIC NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_article ON products(article);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_carts_user ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_session ON carts(session_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Insert sample pricing rules
INSERT INTO price_rules (rule_name, brand, pct, active) VALUES
  ('Bosch Premium', 'Bosch', 20, true),
  ('Default Markup', NULL, 15, true)
ON CONFLICT DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ BroCar database schema created successfully!';
  RAISE NOTICE 'Tables created: suppliers, price_rules, products, carts, cart_items, orders, order_items';
END $$;

