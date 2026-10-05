-- Sino ang pwedeng tumira sa rental: both | female | male. Safe to run more than once.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS allowed_gender TEXT NOT NULL DEFAULT 'both' CHECK (allowed_gender IN ('both', 'female', 'male'));

NOTIFY pgrst, 'reload schema';
