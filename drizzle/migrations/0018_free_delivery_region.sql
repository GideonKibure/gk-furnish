-- Region where a product is delivered free. Shown on the product page.
-- Safe to run more than once. Until this runs, free delivery stays a yes/no flag.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS free_delivery_region text;

DO $$ BEGIN
  ALTER TABLE public.products ADD CONSTRAINT products_free_delivery_region_check
    CHECK (
      free_delivery_region IS NULL OR free_delivery_region IN (
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
