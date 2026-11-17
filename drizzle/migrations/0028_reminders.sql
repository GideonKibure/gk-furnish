-- Phase 6 reminders. Additive. The owner runs this in the Supabase SQL editor.
-- reminders_enabled defaults off. Auto-cancel also stays off while the day counts are blank or 0.
-- Suggested numbers, once you choose to turn cancel on: 3 days for shop orders, 7 days for quotations.

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS quote_unpaid_expiry_days integer;

COMMENT ON COLUMN public.site_settings.reminders_enabled IS
  'Master switch for reminders and auto-cancel. Off until the owner turns it on.';
COMMENT ON COLUMN public.site_settings.quote_unpaid_expiry_days IS
  'Days before an unanswered sent quotation is cancelled. Null or 0 keeps that cancel off.';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS auto_cancel_disabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.orders.auto_cancel_disabled IS
  'When true, the unpaid-expiry job must not cancel this order.';

CREATE TABLE IF NOT EXISTS public.reminder_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  entity text NOT NULL,
  entity_id uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, entity, entity_id)
);

COMMENT ON TABLE public.reminder_sends IS
  'One row per reminder or cancel decision so a cron run can be repeated safely.';

ALTER TABLE public.reminder_sends ENABLE ROW LEVEL SECURITY;
