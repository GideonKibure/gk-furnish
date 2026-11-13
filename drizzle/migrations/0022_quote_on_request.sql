-- Hide the public price and show "Get quote" when this is on.
-- Safe to run more than once. Existing products keep their prices.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS quote_on_request boolean NOT NULL DEFAULT false;
