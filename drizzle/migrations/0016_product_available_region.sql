-- Region where a product is available. Shown on product cards.
-- Safe to run more than once. The shop keeps working before this runs.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS available_region text;

DO $$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_available_region_check
    CHECK (
      available_region IS NULL OR available_region IN (
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
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
