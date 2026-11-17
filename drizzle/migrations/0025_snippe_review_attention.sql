-- Allow a payment to be held for review, and flag an order when stock cannot cover a sale.
-- Safe to run more than once. Does not remove columns the site already reads.
-- The app still runs before this file is applied: review is also stored in payment metadata,
-- and the stock flag is skipped until these columns exist.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS confirmed_via text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS needs_attention boolean NOT NULL DEFAULT false;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS needs_attention_reason text;

-- Widen the payment status check so needs_review is allowed. Existing statuses stay valid.
DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'payments'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
      AND pg_get_constraintdef(c.oid) NOT ILIKE '%needs_review%'
  LOOP
    EXECUTE format('ALTER TABLE public.payments DROP CONSTRAINT %I', constraint_name);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'payments'
      AND c.conname = 'payments_status_check'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_status_check
      CHECK (status IN ('pending', 'completed', 'failed', 'expired', 'needs_review'));
  END IF;
END $$;

-- payment_events.event_id is already UNIQUE (migration 0010). Snippe stores provider event ids there.
