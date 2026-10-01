-- Ayusin ang Security Advisor warnings (safe to run more than once)

-- 1. Function search_path: fixed na para hindi mapalitan ng umaatake
alter function public.is_admin() set search_path = '';
alter function public.protect_property_billing() set search_path = '';
alter function public.set_updated_at() set search_path = public, pg_temp;

-- 2. Public buckets: gumagana ang image URL kahit walang SELECT policy; ito ay nagpapahintulot lang mag-LIST ng lahat ng file
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Anyone can view update images" on storage.objects;
-- (Admin pa rin ang may ALL access sa update-images via "Admins manage update images")
