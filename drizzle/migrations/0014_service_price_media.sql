-- Price and a photo or looping video on each workshop service.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS price_tzs integer,
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_kind text;

ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_media_kind_check;

ALTER TABLE public.services
  ADD CONSTRAINT services_media_kind_check
  CHECK (media_kind IS NULL OR media_kind IN ('image', 'video'));
