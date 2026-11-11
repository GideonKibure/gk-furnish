-- Whether a product is new or used. Shown as a badge on product cards.
-- Safe to run more than once. Existing products start as new.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS item_condition text NOT NULL DEFAULT 'new';

DO $$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_item_condition_check
    CHECK (item_condition IN ('new', 'used'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
