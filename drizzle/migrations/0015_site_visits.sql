-- Anonymous shop visits. Only the service role can read or write this table.
-- The admin portal reads it through an admin-only server function.
CREATE TABLE IF NOT EXISTS public.site_visits (
  id uuid PRIMARY KEY,
  visitor_id uuid NOT NULL,
  user_id uuid,
  landing_path text NOT NULL,
  last_path text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0 AND duration_seconds <= 86400),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_visits_started_idx ON public.site_visits (started_at DESC);
CREATE INDEX IF NOT EXISTS site_visits_visitor_idx ON public.site_visits (visitor_id);

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.site_visits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.site_visits TO service_role;
