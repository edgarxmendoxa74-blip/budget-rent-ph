-- ============================================
-- Missing columns used by the Add/Edit Listing forms
-- Run this in the Supabase SQL Editor (safe to run more than once).
-- ============================================

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS advance_months INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deposit_months INT DEFAULT 2,
  ADD COLUMN IF NOT EXISTS availability   TEXT DEFAULT 'Available';

-- Existing listings count as available
UPDATE public.properties SET availability = 'Available' WHERE availability IS NULL;

-- Refresh PostgREST schema cache so the API sees the new columns right away
NOTIFY pgrst, 'reload schema';
