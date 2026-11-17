-- Policy settings and the version the customer accepted. Safe to run more than once.
-- Run this in the Supabase SQL editor before saving these settings or accepting policies at checkout.

alter table public.site_settings add column if not exists warranty_months_structure integer;
alter table public.site_settings add column if not exists warranty_months_finish integer;
alter table public.site_settings add column if not exists inspection_window_hours integer default 48;
alter table public.site_settings add column if not exists refund_processing_days integer;
alter table public.site_settings add column if not exists ready_made_return_window_hours integer;
alter table public.site_settings add column if not exists unpaid_expiry_days integer;
alter table public.site_settings add column if not exists policy_version text;

alter table public.orders add column if not exists policy_version text;
alter table public.orders add column if not exists policy_accepted_at timestamptz;

comment on column public.site_settings.inspection_window_hours is 'Hours to report visible damage at handover. Default 48 until the owner sets another number. Null means not set.';
comment on column public.site_settings.ready_made_return_window_hours is 'Hours a ready-made piece can be returned before delivery. 0 means no returns.';
comment on column public.site_settings.unpaid_expiry_days is 'Used later for unpaid-order expiry. 0 or null means that feature stays off.';
comment on column public.orders.policy_accepted_at is 'Set once at checkout. Do not update it.';
