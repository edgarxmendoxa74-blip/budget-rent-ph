-- Rentals na maraming kwarto: per room o buong bahay lang, at ilang kwarto na ang occupied. Safe to run more than once.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS rental_mode TEXT NOT NULL DEFAULT 'rooms' CHECK (rental_mode IN ('rooms', 'whole')),
  ADD COLUMN IF NOT EXISTS occupied_rooms INTEGER NOT NULL DEFAULT 0 CHECK (occupied_rooms >= 0);

NOTIFY pgrst, 'reload schema';
