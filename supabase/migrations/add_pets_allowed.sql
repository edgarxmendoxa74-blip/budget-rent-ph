-- Staycation listings: pets allowed or not (safe to run more than once)
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS pets_allowed TEXT DEFAULT 'No';

UPDATE public.properties SET pets_allowed = 'No' WHERE pets_allowed IS NULL;

NOTIFY pgrst, 'reload schema';
