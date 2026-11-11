-- Free delivery can cover several regions, or all of Tanzania.
-- A region already saved in free_delivery_region is copied into the list.
-- Safe to run more than once.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS free_delivery_regions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS free_delivery_country boolean NOT NULL DEFAULT false;

UPDATE public.products
SET free_delivery_regions = ARRAY[free_delivery_region]
WHERE free_delivery_region IS NOT NULL
  AND cardinality(free_delivery_regions) = 0;

DO $$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_free_delivery_regions_check
    CHECK (
      free_delivery_regions <@ ARRAY[
        'Mbeya',
        'Arusha',
        'Dar es Salaam',
        'Dodoma',
        'Geita',
        'Iringa',
        'Kagera',
        'Katavi',
        'Kigoma',
        'Kilimanjaro',
        'Lindi',
        'Manyara',
        'Mara',
        'Morogoro',
        'Mtwara',
        'Mwanza',
        'Njombe',
        'Pemba North',
        'Pemba South',
        'Pwani',
        'Rukwa',
        'Ruvuma',
        'Shinyanga',
        'Simiyu',
        'Singida',
        'Songwe',
        'Tabora',
        'Tanga',
        'Unguja North',
        'Unguja South',
        'Zanzibar Urban West'
      ]::text[]
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
