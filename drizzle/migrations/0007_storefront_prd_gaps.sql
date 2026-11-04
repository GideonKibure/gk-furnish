-- Storefront PRD gaps: catalogue fields, delivery/collection, guest tracking,
-- saved addresses, custom request quotations, verified reviews and notifications.
--
-- RUN ORDER: paste into the Supabase SQL Editor AFTER 0006_customers_cart_payment_policy.sql.
-- Safe to run more than once. The website keeps working before this runs; the new
-- features switch on once it has been applied.

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'in_house',
  ADD COLUMN IF NOT EXISTS is_customisable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS finish text,
  ADD COLUMN IF NOT EXISTS finish_sw text,
  ADD COLUMN IF NOT EXISTS care_info text,
  ADD COLUMN IF NOT EXISTS care_info_sw text,
  ADD COLUMN IF NOT EXISTS compare_at_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS discount_percent int,
  ADD COLUMN IF NOT EXISTS free_delivery boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock_display text NOT NULL DEFAULT 'label';

DO $$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_status_check CHECK (status IN ('active','draft','archived'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_source_type_check CHECK (source_type IN ('in_house','partner'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_compare_at_price_check CHECK (compare_at_price IS NULL OR compare_at_price >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_discount_percent_check CHECK (discount_percent IS NULL OR discount_percent BETWEEN 1 AND 90);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_stock_display_check CHECK (stock_display IN ('label','count'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS products_sku_key ON public.products(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_status_idx ON public.products(status);

-- Draft and archived products are hidden from the public catalogue.
-- The admin portal reads through the service role and still sees everything.
DROP POLICY IF EXISTS "Products are publicly readable" ON public.products;
CREATE POLICY "Products are publicly readable" ON public.products
  FOR SELECT USING (status = 'active');

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- Orders: delivery or collection, delivery fee, guest tracking
-- total_amount = subtotal_amount + COALESCE(delivery_fee, 0)
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS fulfilment_method text NOT NULL DEFAULT 'delivery',
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS address_line text,
  ADD COLUMN IF NOT EXISTS subtotal_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS delivery_fee numeric(12,2),
  ADD COLUMN IF NOT EXISTS delivery_fee_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT orders_fulfilment_method_check CHECK (fulfilment_method IN ('delivery','collection'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT orders_delivery_fee_status_check CHECK (delivery_fee_status IN ('pending','confirmed','free'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.orders ADD CONSTRAINT orders_delivery_fee_check CHECK (delivery_fee IS NULL OR delivery_fee >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Orders placed before this migration had no delivery fee: treat it as settled at 0.
UPDATE public.orders
SET subtotal_amount = total_amount, delivery_fee = 0, delivery_fee_status = 'confirmed'
WHERE subtotal_amount IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_tracking_token_key ON public.orders(tracking_token);
CREATE INDEX IF NOT EXISTS orders_status_created_idx ON public.orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders(created_at DESC);

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS collection_address text;

-- ---------------------------------------------------------------------------
-- Saved customer addresses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text,
  full_name text,
  phone text,
  region text NOT NULL,
  district text,
  area text,
  address_line text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Customers manage own addresses" ON public.customer_addresses;
CREATE POLICY "Customers manage own addresses" ON public.customer_addresses
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS customer_addresses_user_idx ON public.customer_addresses(user_id);

-- ---------------------------------------------------------------------------
-- Custom requests
-- ---------------------------------------------------------------------------
ALTER TABLE public.custom_orders
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS needed_by date,
  ADD COLUMN IF NOT EXISTS budget text,
  ADD COLUMN IF NOT EXISTS finish text,
  ADD COLUMN IF NOT EXISTS tracking_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS exception_note text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS custom_orders_tracking_token_key ON public.custom_orders(tracking_token);
CREATE INDEX IF NOT EXISTS custom_orders_user_idx ON public.custom_orders(user_id);

-- Quotation versions (previously stored as JSON in custom_orders.budget_range)
CREATE TABLE IF NOT EXISTS public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_order_id uuid NOT NULL REFERENCES public.custom_orders(id) ON DELETE CASCADE,
  version int NOT NULL,
  quote_number text NOT NULL UNIQUE,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  total numeric(12,2) NOT NULL DEFAULT 0,
  advance_percent int NOT NULL DEFAULT 50,
  valid_until date,
  inclusions text,
  exclusions text,
  estimated_completion date,
  notes text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('draft','sent','accepted','rejected','changes_requested','expired','superseded')),
  customer_response text,
  responded_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (custom_order_id, version)
);
GRANT ALL ON public.quotations TO service_role;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS quotations_custom_order_idx ON public.quotations(custom_order_id);

-- Copy existing JSON quotes into the table. budget_range is left untouched.
INSERT INTO public.quotations (
  custom_order_id, version, quote_number, lines, total, advance_percent, valid_until, notes, details, status, created_at
)
SELECT
  c.id,
  q.ord::int,
  q.item->>'number',
  COALESCE(q.item->'lines', '[]'::jsonb),
  COALESCE((
    SELECT SUM((l->>'quantity')::numeric * (l->>'unitPrice')::numeric)
    FROM jsonb_array_elements(COALESCE(q.item->'lines', '[]'::jsonb)) l
  ), 0),
  COALESCE(NULLIF(q.item->>'advancePercent', '')::int, 50),
  NULLIF(q.item->>'validUntil', '')::date,
  q.item->>'notes',
  q.item - 'lines' - 'number' - 'notes' - 'validUntil' - 'advancePercent',
  'sent',
  COALESCE(NULLIF(q.item->>'createdAt', '')::timestamptz, c.created_at)
FROM public.custom_orders c
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN c.budget_range LIKE '[%' THEN c.budget_range::jsonb ELSE '[]'::jsonb END
) WITH ORDINALITY AS q(item, ord)
WHERE jsonb_typeof(q.item) = 'object'
  AND q.item ? 'number'
ON CONFLICT DO NOTHING;

-- Older versions are superseded by the newest one.
UPDATE public.quotations q SET status = 'superseded'
WHERE q.status = 'sent' AND EXISTS (
  SELECT 1 FROM public.quotations n WHERE n.custom_order_id = q.custom_order_id AND n.version > q.version
);

-- ---------------------------------------------------------------------------
-- Verified product reviews (admin approval required)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  body text,
  author_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_reviews TO anon, authenticated;
GRANT ALL ON public.product_reviews TO service_role;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Approved reviews are public" ON public.product_reviews;
CREATE POLICY "Approved reviews are public" ON public.product_reviews
  FOR SELECT USING (status = 'approved');
CREATE INDEX IF NOT EXISTS product_reviews_product_idx ON public.product_reviews(product_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS product_reviews_one_per_user
  ON public.product_reviews(product_id, user_id) WHERE user_id IS NOT NULL;

CREATE OR REPLACE VIEW public.product_rating_summary
WITH (security_invoker = true) AS
SELECT product_id, ROUND(AVG(rating)::numeric, 1) AS rating_avg, COUNT(*)::int AS rating_count
FROM public.product_reviews
WHERE status = 'approved'
GROUP BY product_id;
GRANT SELECT ON public.product_rating_summary TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- In-app notifications (customers and staff)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience text NOT NULL CHECK (audience IN ('customer','staff')),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  entity text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Customers read own notifications" ON public.notifications;
CREATE POLICY "Customers read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (audience = 'customer' AND auth.uid() = user_id);
DROP POLICY IF EXISTS "Customers mark own notifications read" ON public.notifications;
CREATE POLICY "Customers mark own notifications read" ON public.notifications
  FOR UPDATE TO authenticated USING (audience = 'customer' AND auth.uid() = user_id)
  WITH CHECK (audience = 'customer' AND auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_audience_idx ON public.notifications(audience, read_at, created_at DESC);
