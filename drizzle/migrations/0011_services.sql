-- Workshop services the admin can add. The homepage shows published rows only.
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_sw text,
  description text,
  description_sw text,
  sort_order int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.services TO anon, authenticated;
GRANT ALL ON public.services TO service_role;

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published services are publicly readable" ON public.services;
CREATE POLICY "Published services are publicly readable"
  ON public.services
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true);
