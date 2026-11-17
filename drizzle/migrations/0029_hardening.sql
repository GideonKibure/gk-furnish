-- Phase 7. Additive. The owner runs this in the Supabase SQL editor.
-- Rate buckets and heartbeats are server-only. The password rule starts on, and can be turned off
-- from Admin → Account if a reset needs a simpler password. It does not sign anyone out.

CREATE TABLE IF NOT EXISTS public.form_rate_buckets (
  form text NOT NULL,
  subject text NOT NULL,
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (form, subject, window_start)
);

CREATE TABLE IF NOT EXISTS public.system_heartbeats (
  name text PRIMARY KEY,
  seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS owner_strong_password boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.site_settings.owner_strong_password IS
  'When true, the next owner password must be long and mixed. The current password keeps working.';

ALTER TABLE public.form_rate_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_heartbeats ENABLE ROW LEVEL SECURITY;
