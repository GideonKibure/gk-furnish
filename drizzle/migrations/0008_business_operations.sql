-- Business operations (phase 2): audit log, extended order statuses, delivery records, refunds,
-- product costs, inventory, suppliers, purchasing, production, quality checks, expenses,
-- capital and assets, private receipts bucket.
--
-- RUN ORDER: paste into the Supabase SQL Editor AFTER 0007_storefront_prd_gaps.sql.
-- Safe to run more than once. Every new table has RLS on and no browser policies:
-- the admin portal reads and writes them through server functions (service role) only.

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor uuid,
  actor_email text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON public.audit_logs(entity, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs(created_at DESC);

-- ---------------------------------------------------------------------------
-- Orders: more statuses, reasons, previous status in the history
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'pending','awaiting_payment','confirmed','processing','in_production','ready',
  'out_for_delivery','delivered','completed','cancelled','refunded'
));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS status_reason text;

ALTER TABLE public.order_status_history
  ADD COLUMN IF NOT EXISTS previous_status text,
  ADD COLUMN IF NOT EXISTS actor text;

-- One history row per status change, written only by this trigger. Server code adds the
-- note and actor to that row afterwards instead of inserting a second row.
CREATE OR REPLACE FUNCTION public.log_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_status_history (order_id, status, previous_status)
    VALUES (NEW.id, NEW.status, NULL);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_history (order_id, status, previous_status)
    VALUES (NEW.id, NEW.status, OLD.status);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_status_log ON public.orders;
CREATE TRIGGER orders_status_log
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_status();

-- ---------------------------------------------------------------------------
-- Delivery records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  method text NOT NULL DEFAULT 'delivery' CHECK (method IN ('delivery','collection')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  received_by text,
  handled_by text,
  cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.delivery_records TO service_role;
ALTER TABLE public.delivery_records ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS delivery_records_order_idx ON public.delivery_records(order_id);

-- ---------------------------------------------------------------------------
-- Refunds (reduce what the order has been paid; a reason is required)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL CHECK (length(trim(reason)) >= 3),
  method text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS refunds_order_idx ON public.refunds(order_id);
CREATE INDEX IF NOT EXISTS refunds_payment_idx ON public.refunds(payment_id);

-- ---------------------------------------------------------------------------
-- Product costs (internal only, never shown on the storefront)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_costs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  material_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (material_cost >= 0),
  labour_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (labour_cost >= 0),
  overhead_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (overhead_cost >= 0),
  partner_price numeric(12,2) CHECK (partner_price IS NULL OR partner_price >= 0),
  transport_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (transport_cost >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.product_costs TO service_role;
ALTER TABLE public.product_costs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  location text,
  products_services text,
  payment_terms text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  rating int CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS suppliers_status_idx ON public.suppliers(status, name);

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'raw' CHECK (kind IN ('raw','wip','finished','partner','damaged')),
  unit text NOT NULL DEFAULT 'pcs',
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity numeric(14,3) NOT NULL DEFAULT 0,
  reorder_level numeric(14,3) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  unit_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  location text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_sku_key ON public.inventory_items(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_items_kind_idx ON public.inventory_items(kind);
CREATE INDEX IF NOT EXISTS inventory_items_product_idx ON public.inventory_items(product_id);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'purchase_in','production_use','production_out','sale_out','adjustment','damage','return_in','transfer','opening'
  )),
  quantity_change numeric(14,3) NOT NULL CHECK (quantity_change <> 0),
  unit_cost numeric(12,2),
  ref_entity text,
  ref_id uuid,
  note text,
  actor text,
  authorised_negative boolean NOT NULL DEFAULT false,
  quantity_after numeric(14,3),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS inventory_movements_item_idx ON public.inventory_movements(item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_movements_ref_idx ON public.inventory_movements(ref_entity, ref_id);

-- Apply each movement to the item. Stock may not go below zero unless the movement is
-- marked authorised_negative (BR-10). Finished items linked to a product keep the
-- product's stock_quantity in step.
CREATE OR REPLACE FUNCTION public.apply_inventory_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item public.inventory_items%ROWTYPE;
  next_qty numeric(14,3);
BEGIN
  SELECT * INTO item FROM public.inventory_items WHERE id = NEW.item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item % not found', NEW.item_id;
  END IF;
  next_qty := item.quantity + NEW.quantity_change;
  IF next_qty < 0 AND NOT NEW.authorised_negative THEN
    RAISE EXCEPTION 'Not enough stock of % (have %, need %)', item.name, item.quantity, -NEW.quantity_change
      USING ERRCODE = 'P0001', HINT = 'negative_stock';
  END IF;
  NEW.quantity_after := next_qty;
  UPDATE public.inventory_items
  SET quantity = next_qty,
      unit_cost = CASE
        WHEN NEW.type = 'purchase_in' AND NEW.unit_cost IS NOT NULL AND next_qty > 0 AND item.quantity >= 0
          THEN round(((item.quantity * item.unit_cost) + (NEW.quantity_change * NEW.unit_cost)) / next_qty, 2)
        ELSE item.unit_cost
      END,
      updated_at = now()
  WHERE id = item.id;
  IF item.kind = 'finished' AND item.product_id IS NOT NULL THEN
    UPDATE public.products
    SET stock_quantity = GREATEST(0, floor(next_qty))::int, updated_at = now()
    WHERE id = item.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_movements_apply ON public.inventory_movements;
CREATE TRIGGER inventory_movements_apply
BEFORE INSERT ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_movement();

-- ---------------------------------------------------------------------------
-- Purchasing
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.po_number_seq START 1;
CREATE OR REPLACE FUNCTION public.generate_po_number()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'PO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.po_number_seq')::text, 4, '0');
$$;

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL UNIQUE DEFAULT public.generate_po_number(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','partially_received','received','cancelled')),
  order_date date NOT NULL DEFAULT current_date,
  expected_date date,
  deposit_paid numeric(12,2) NOT NULL DEFAULT 0 CHECK (deposit_paid >= 0),
  total numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  transport_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (transport_cost >= 0),
  inspection_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (inspection_cost >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Set when the PO becomes fully received; reports book partner costs in that period.
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS received_at timestamptz;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS purchase_orders_supplier_idx ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS purchase_orders_order_idx ON public.purchase_orders(order_id);
CREATE INDEX IF NOT EXISTS purchase_orders_status_idx ON public.purchase_orders(status, expected_date);

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  description text NOT NULL,
  inventory_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  accepted_qty numeric(14,3) NOT NULL DEFAULT 0 CHECK (accepted_qty >= 0),
  rejected_qty numeric(14,3) NOT NULL DEFAULT 0 CHECK (rejected_qty >= 0),
  defect_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.purchase_items TO service_role;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS purchase_items_po_idx ON public.purchase_items(po_id);
CREATE INDEX IF NOT EXISTS purchase_items_order_item_idx ON public.purchase_items(order_item_id);

CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  method text,
  paid_at date NOT NULL DEFAULT current_date,
  reference text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.supplier_payments TO service_role;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS supplier_payments_supplier_idx ON public.supplier_payments(supplier_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS supplier_payments_po_idx ON public.supplier_payments(po_id);

-- ---------------------------------------------------------------------------
-- Production
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.job_number_seq START 1;
CREATE OR REPLACE FUNCTION public.generate_job_number()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'JOB-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.job_number_seq')::text, 4, '0');
$$;

CREATE TABLE IF NOT EXISTS public.production_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number text NOT NULL UNIQUE DEFAULT public.generate_job_number(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  route text NOT NULL DEFAULT 'in_house' CHECK (route IN ('in_house','partner')),
  assignee text,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued','materials_ready','cutting','assembly','finishing','quality_check','completed','on_hold'
  )),
  target_date date,
  started_at timestamptz,
  completed_at timestamptz,
  est_material_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (est_material_cost >= 0),
  est_labour_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (est_labour_cost >= 0),
  est_overhead_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (est_overhead_cost >= 0),
  act_material_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (act_material_cost >= 0),
  act_labour_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (act_labour_cost >= 0),
  act_overhead_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (act_overhead_cost >= 0),
  completed_qty int NOT NULL DEFAULT 0 CHECK (completed_qty >= 0),
  exception_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.production_jobs TO service_role;
ALTER TABLE public.production_jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS production_jobs_status_idx ON public.production_jobs(status, target_date);
CREATE INDEX IF NOT EXISTS production_jobs_order_idx ON public.production_jobs(order_id);

CREATE TABLE IF NOT EXISTS public.production_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.production_jobs(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.production_materials TO service_role;
ALTER TABLE public.production_materials ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS production_materials_job_idx ON public.production_materials(job_id);

CREATE TABLE IF NOT EXISTS public.quality_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.production_jobs(id) ON DELETE CASCADE,
  po_id uuid REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  result text NOT NULL CHECK (result IN ('pass','fail','rework')),
  notes text,
  checked_by text,
  checked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quality_checks_target_check CHECK (job_id IS NOT NULL OR po_id IS NOT NULL)
);
GRANT ALL ON public.quality_checks TO service_role;
ALTER TABLE public.quality_checks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS quality_checks_job_idx ON public.quality_checks(job_id);
CREATE INDEX IF NOT EXISTS quality_checks_po_idx ON public.quality_checks(po_id);

-- ---------------------------------------------------------------------------
-- Expenses, capital and assets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT current_date,
  category text NOT NULL CHECK (category IN (
    'rent','utilities','transport','materials','wages','marketing','payment_fees','maintenance','other'
  )),
  description text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method text,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  receipt_path text,
  archived_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS expenses_date_idx ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON public.expenses(category);

CREATE TABLE IF NOT EXISTS public.capital_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT current_date,
  source text NOT NULL CHECK (source IN ('owner_funds','gift','loan')),
  contributor text,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  terms text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.capital_contributions TO service_role;
ALTER TABLE public.capital_contributions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  purchase_date date,
  cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  useful_life_months int CHECK (useful_life_months IS NULL OR useful_life_months > 0),
  notes text,
  disposed_at date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Private bucket for expense and supplier receipts (signed URLs only)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('business-receipts', 'business-receipts', false)
ON CONFLICT (id) DO UPDATE SET public = false;
