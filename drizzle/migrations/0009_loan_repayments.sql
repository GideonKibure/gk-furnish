-- Loan repayments: track what is still owed on each loan recorded under Capital & assets.
--
-- RUN ORDER: paste into the Supabase SQL Editor AFTER 0008_business_operations.sql.
-- Safe to run more than once. RLS is on with no browser policies; the admin portal
-- reads and writes through server functions (service role) only.
--
-- Accounting: principal repaid is cash out but not an expense; interest paid is an
-- expense (finance cost) and reduces profit. Neither is ever revenue.

ALTER TABLE public.capital_contributions
  ADD COLUMN IF NOT EXISTS due_date date;

CREATE TABLE IF NOT EXISTS public.loan_repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.capital_contributions(id) ON DELETE CASCADE,
  paid_on date NOT NULL DEFAULT current_date,
  principal numeric(12,2) NOT NULL DEFAULT 0 CHECK (principal >= 0),
  interest numeric(12,2) NOT NULL DEFAULT 0 CHECK (interest >= 0),
  method text,
  reference text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (principal + interest > 0)
);
GRANT ALL ON public.loan_repayments TO service_role;
ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS loan_repayments_loan_idx ON public.loan_repayments(loan_id, paid_on);
CREATE INDEX IF NOT EXISTS loan_repayments_paid_on_idx ON public.loan_repayments(paid_on);

-- Repayments may only be recorded against loans, and principal may not exceed what was borrowed.
CREATE OR REPLACE FUNCTION public.check_loan_repayment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  loan_source text;
  borrowed numeric(12,2);
  repaid numeric(12,2);
BEGIN
  SELECT source, amount INTO loan_source, borrowed
  FROM public.capital_contributions WHERE id = NEW.loan_id;
  IF loan_source IS DISTINCT FROM 'loan' THEN
    RAISE EXCEPTION 'Repayments can only be recorded against a loan';
  END IF;
  SELECT COALESCE(SUM(principal), 0) INTO repaid
  FROM public.loan_repayments
  WHERE loan_id = NEW.loan_id AND id IS DISTINCT FROM NEW.id;
  IF repaid + NEW.principal > borrowed THEN
    RAISE EXCEPTION 'Principal repaid (%) would exceed the amount borrowed (%)', repaid + NEW.principal, borrowed;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS loan_repayments_check ON public.loan_repayments;
CREATE TRIGGER loan_repayments_check
  BEFORE INSERT OR UPDATE ON public.loan_repayments
  FOR EACH ROW EXECUTE FUNCTION public.check_loan_repayment();
