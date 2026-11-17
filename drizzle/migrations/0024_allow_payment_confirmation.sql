-- The live database rejects every payment update with
-- "payment records are managed by the server".
-- Snippe can collect the money, but the site can never mark the order paid.
-- Remove only the guard whose message is that sentence. Run once in the Supabase SQL editor.

DO $$
DECLARE
  trg record;
BEGIN
  FOR trg IN
    SELECT t.tgname AS trigger_name, p.oid::regprocedure AS function_id, pg_get_functiondef(p.oid) AS definition
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'public.payments'::regclass
      AND NOT t.tgisinternal
  LOOP
    IF trg.definition ILIKE '%payment records are managed by the server%' THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.payments', trg.trigger_name);
      EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', trg.function_id);
    END IF;
  END LOOP;
END $$;
