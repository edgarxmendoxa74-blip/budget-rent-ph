-- ============================================
-- Map / Radar feature: property coordinates
-- Run this in the Supabase SQL Editor.
-- ============================================

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_latitude_range,
  DROP CONSTRAINT IF EXISTS properties_longitude_range;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_latitude_range  CHECK (latitude  IS NULL OR latitude  BETWEEN -90  AND 90),
  ADD CONSTRAINT properties_longitude_range CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);

-- Speeds up bounding-box lookups for the nearby radar
CREATE INDEX IF NOT EXISTS idx_properties_lat_lng
  ON public.properties (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
