-- One checkout submit key, so a double tap returns the same order.
-- Safe to run more than once. The site still accepts orders before this column exists.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS client_request_id text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_client_request_id_key
  ON public.orders (client_request_id)
  WHERE client_request_id IS NOT NULL;
