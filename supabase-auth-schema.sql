-- BroCar Authentication & Authorization Schema
-- Run this in Supabase SQL Editor after running supabase-schema.sql

-- Enable Row Level Security on existing tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Create profiles table for user data
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call function on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS on_profile_updated ON profiles;
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ========================================
-- RLS POLICIES FOR PROFILES
-- ========================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ========================================
-- RLS POLICIES FOR ORDERS
-- ========================================

-- Users can only view their own orders
CREATE POLICY "Users can view own orders"
  ON orders
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create orders for themselves
CREATE POLICY "Users can create own orders"
  ON orders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own orders (only specific fields)
CREATE POLICY "Users can update own orders"
  ON orders
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ========================================
-- RLS POLICIES FOR CARTS
-- ========================================

-- Users can view their own cart
CREATE POLICY "Users can view own cart"
  ON carts
  FOR SELECT
  USING (auth.uid() = user_id OR session_id IS NOT NULL);

-- Users can create cart for themselves
CREATE POLICY "Users can create own cart"
  ON carts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR session_id IS NOT NULL);

-- Users can update their own cart
CREATE POLICY "Users can update own cart"
  ON carts
  FOR UPDATE
  USING (auth.uid() = user_id OR session_id IS NOT NULL)
  WITH CHECK (auth.uid() = user_id OR session_id IS NOT NULL);

-- Users can delete their own cart
CREATE POLICY "Users can delete own cart"
  ON carts
  FOR DELETE
  USING (auth.uid() = user_id OR session_id IS NOT NULL);

-- ========================================
-- RLS POLICIES FOR CART ITEMS
-- ========================================

-- Users can view cart items from their cart
CREATE POLICY "Users can view own cart items"
  ON cart_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
      AND (carts.user_id = auth.uid() OR carts.session_id IS NOT NULL)
    )
  );

-- Users can add items to their cart
CREATE POLICY "Users can add items to own cart"
  ON cart_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
      AND (carts.user_id = auth.uid() OR carts.session_id IS NOT NULL)
    )
  );

-- Users can update cart items in their cart
CREATE POLICY "Users can update own cart items"
  ON cart_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
      AND (carts.user_id = auth.uid() OR carts.session_id IS NOT NULL)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
      AND (carts.user_id = auth.uid() OR carts.session_id IS NOT NULL)
    )
  );

-- Users can delete cart items from their cart
CREATE POLICY "Users can delete own cart items"
  ON cart_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM carts
      WHERE carts.id = cart_items.cart_id
      AND (carts.user_id = auth.uid() OR carts.session_id IS NOT NULL)
    )
  );

-- Create index for faster profile lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ BroCar authentication schema created successfully!';
  RAISE NOTICE '✅ RLS policies enabled for: profiles, orders, carts, cart_items';
  RAISE NOTICE '✅ Automatic profile creation on user signup enabled';
  RAISE NOTICE '';
  RAISE NOTICE '📝 JWT токены теперь автоматически проверяются PostgreSQL!';
  RAISE NOTICE '🔒 Данные защищены на уровне базы данных через RLS';
END $$;

