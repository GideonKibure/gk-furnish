-- Customer accounts, shopping cart and payment policy.
-- Run in the Supabase SQL Editor before deploying the code that uses these columns.

-- Customer profiles (one per Supabase Auth user)
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  default_location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.customer_profiles TO authenticated;
GRANT ALL ON public.customer_profiles TO service_role;
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Customers read own profile" ON public.customer_profiles;
CREATE POLICY "Customers read own profile" ON public.customer_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Customers insert own profile" ON public.customer_profiles;
CREATE POLICY "Customers insert own profile" ON public.customer_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Customers update own profile" ON public.customer_profiles;
CREATE POLICY "Customers update own profile" ON public.customer_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.customer_profiles (user_id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_customer ON auth.users;
CREATE TRIGGER on_auth_user_created_customer
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();

-- Saved carts for signed-in customers (guests keep their cart in the browser)
CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity int NOT NULL CHECK (quantity > 0 AND quantity <= 100),
  material text NOT NULL DEFAULT '',
  size text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id, material, size, color)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Customers manage own cart" ON public.cart_items;
CREATE POLICY "Customers manage own cart" ON public.cart_items
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS cart_items_user_idx ON public.cart_items(user_id);

-- Orders: owner, totals and policy fields
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS total_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_percent int NOT NULL DEFAULT 50 CHECK (advance_percent BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS advance_required numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS specs_agreed_at timestamptz,
  ADD COLUMN IF NOT EXISTS specs_agreed_by text,
  ADD COLUMN IF NOT EXISTS needed_by date,
  ADD COLUMN IF NOT EXISTS stock_applied boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders(user_id);
GRANT SELECT ON public.orders TO authenticated;
DROP POLICY IF EXISTS "Customers read own orders" ON public.orders;
CREATE POLICY "Customers read own orders" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Existing orders: fill totals, keep their stock as already reduced, and treat
-- orders that are already past "pending" as having agreed specifications.
UPDATE public.orders o
SET total_amount = COALESCE((
      SELECT SUM(i.quantity * i.unit_price) FROM public.order_items i WHERE i.order_id = o.id
    ), 0)
WHERE o.total_amount = 0;
UPDATE public.orders
SET advance_required = ROUND(total_amount * advance_percent / 100.0),
    stock_applied = true
WHERE advance_required = 0;
UPDATE public.orders
SET specs_agreed_at = created_at, specs_agreed_by = 'Existing order'
WHERE specs_agreed_at IS NULL AND status NOT IN ('pending', 'cancelled');

-- Each order line keeps its own options
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS material text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS color text;

-- Payments: purpose and receipt numbers; one row per Snippe reference
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'advance'
    CHECK (purpose IN ('advance', 'balance', 'full')),
  ADD COLUMN IF NOT EXISTS receipt_number text;
CREATE UNIQUE INDEX IF NOT EXISTS payments_snippe_reference_key
  ON public.payments(snippe_reference) WHERE snippe_reference IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_receipt_number_key
  ON public.payments(receipt_number) WHERE receipt_number IS NOT NULL;

-- Advance payment tiers (editable in admin Site settings)
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS advance_standard_percent int NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS advance_custom_percent int NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS advance_large_percent int NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS advance_expensive_from numeric(12,2) NOT NULL DEFAULT 1000000,
  ADD COLUMN IF NOT EXISTS advance_large_from numeric(12,2) NOT NULL DEFAULT 3000000,
  ADD COLUMN IF NOT EXISTS advance_large_items int NOT NULL DEFAULT 10;

ALTER TABLE public.custom_orders
  ADD COLUMN IF NOT EXISTS advance_percent int;
