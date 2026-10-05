-- Kondisyon ng bahay para sa rentals: good | minor | repair, at optional na detalye ng sira. Safe to run more than once.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS house_condition TEXT CHECK (house_condition IS NULL OR house_condition IN ('good', 'minor', 'repair')),
  ADD COLUMN IF NOT EXISTS condition_notes TEXT CHECK (condition_notes IS NULL OR char_length(condition_notes) <= 300);

NOTIFY pgrst, 'reload schema';
