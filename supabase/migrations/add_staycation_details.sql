-- Staycation details set by the landlord: guest limits, in-room features, house rules, cancellation policy
-- (safe to run more than once)
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS max_adults INTEGER,
  ADD COLUMN IF NOT EXISTS max_children INTEGER,
  ADD COLUMN IF NOT EXISTS stay_features TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS house_rules TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_policy TEXT;

NOTIFY pgrst, 'reload schema';
