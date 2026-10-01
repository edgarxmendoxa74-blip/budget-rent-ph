-- Staycation listings: down payment (peso amount) instead of advance/deposit (safe to run more than once)
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS down_payment NUMERIC DEFAULT 0;

NOTIFY pgrst, 'reload schema';
