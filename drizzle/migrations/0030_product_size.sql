-- Optional size, availability, price hint, and delivery estimates.
-- Safe to run more than once. Does not change existing prices or orders.
-- The shop keeps working before this file is run.

alter table public.products add column if not exists width_cm numeric;
alter table public.products add column if not exists depth_cm numeric;
alter table public.products add column if not exists height_cm numeric;
alter table public.products add column if not exists capacity_text_en text;
alter table public.products add column if not exists capacity_text_sw text;
alter table public.products add column if not exists availability_type text;
alter table public.products add column if not exists lead_time_days integer;
alter table public.products add column if not exists price_hint_tzs_from numeric;

alter table public.site_settings add column if not exists delivery_zones jsonb not null default '[]'::jsonb;

comment on column public.products.price_hint_tzs_from is
  'Shown as From TZS only when the product has no selling price. Never a cart price.';
comment on column public.site_settings.delivery_zones is
  'Optional estimates: [{region, fee_tzs}]. Empty hides the estimator. Never added to order totals.';
