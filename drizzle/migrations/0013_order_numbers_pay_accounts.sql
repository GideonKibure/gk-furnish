-- Custom requests keep the yearly number. Orders move to a daily number below.
CREATE OR REPLACE FUNCTION public.generate_request_number()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'GK-' || to_char((now() AT TIME ZONE 'Africa/Dar_es_Salaam'), 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 4, '0');
$$;

ALTER TABLE public.custom_orders
  ALTER COLUMN request_number SET DEFAULT public.generate_request_number();

-- Daily order numbers: GK-20261111-001. Existing numbers are left as they are.
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  day text;
  n int;
BEGIN
  day := to_char((now() AT TIME ZONE 'Africa/Dar_es_Salaam'), 'YYYYMMDD');
  PERFORM pg_advisory_xact_lock(hashtext('gk-order-' || day));
  SELECT count(*) + 1 INTO n
  FROM public.orders
  WHERE order_number LIKE 'GK-' || day || '-%';
  RETURN 'GK-' || day || '-' || lpad(n::text, 3, '0');
END;
$$;

-- Pay-to details the customer sees. The owner edits these in Site settings.
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS mpesa_lipa_number text,
  ADD COLUMN IF NOT EXISTS mpesa_lipa_name text,
  ADD COLUMN IF NOT EXISTS nmb_account_number text,
  ADD COLUMN IF NOT EXISTS nmb_account_name text,
  ADD COLUMN IF NOT EXISTS airtel_number text,
  ADD COLUMN IF NOT EXISTS airtel_name text;

UPDATE public.site_settings
SET
  mpesa_lipa_number = COALESCE(NULLIF(mpesa_lipa_number, ''), '3456672'),
  mpesa_lipa_name = COALESCE(NULLIF(mpesa_lipa_name, ''), 'Gideon Joseph Kibure'),
  nmb_account_name = COALESCE(NULLIF(nmb_account_name, ''), 'Gideon Joseph Kibure'),
  airtel_number = COALESCE(NULLIF(airtel_number, ''), '0692713993'),
  airtel_name = COALESCE(NULLIF(airtel_name, ''), 'GideonJoseph Kibure')
WHERE id = 1;
