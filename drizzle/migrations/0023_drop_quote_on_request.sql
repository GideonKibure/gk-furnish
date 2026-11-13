-- The shop uses an empty price instead of a separate quote flag.
-- Safe to run more than once.

ALTER TABLE public.products DROP COLUMN IF EXISTS quote_on_request;
