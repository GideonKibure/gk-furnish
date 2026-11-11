-- How long GK Furnish tells customers an order takes, in hours.
-- Safe to run more than once. The site keeps saying 48 hours until this runs.

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS order_completion_hours integer NOT NULL DEFAULT 48;

DO $$ BEGIN
  ALTER TABLE public.site_settings ADD CONSTRAINT site_settings_order_completion_hours_check
    CHECK (order_completion_hours BETWEEN 1 AND 720);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
