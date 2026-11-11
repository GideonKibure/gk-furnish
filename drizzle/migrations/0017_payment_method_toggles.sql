-- Let the owner hide a payment method from checkout and the order page.
-- Safe to run more than once. Until this runs, every method stays visible.

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS mpesa_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS airtel_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nmb_enabled boolean NOT NULL DEFAULT true;
