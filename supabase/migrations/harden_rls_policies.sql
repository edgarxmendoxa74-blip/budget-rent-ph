-- Security hardening: isara ang mga butas na nakita sa live pg_policies (safe to run more than once)
-- Admin emails dapat tugma sa src/lib/admin.js
-- IMPORTANT: sa Supabase > Authentication > Providers > Email, dapat naka-ON ang "Confirm email",
-- kung hindi ay puwedeng mag-signup ang kahit sino gamit ang admin email.

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in
    ('admin@budgetrent.ph', 'mendozajakong@gmail.com', 'webnegosyo@budget43.com');
$$;

-- ============================================================
-- properties
-- ============================================================
-- Dati: kahit sino (pati hindi naka-login) ay puwedeng mag-UPDATE ng kahit anong listing
drop policy if exists "Allow admins to update verification status" on public.properties;
drop policy if exists "Allow individual insert" on public.properties;

drop policy if exists "admins_update_properties" on public.properties;
create policy "admins_update_properties" on public.properties
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins_delete_properties" on public.properties;
create policy "admins_delete_properties" on public.properties
  for delete to authenticated
  using (public.is_admin());

-- Dapat sariling user_id lang ang puwedeng i-insert
drop policy if exists "insert_own_properties_v2" on public.properties;
create policy "insert_own_properties_v2" on public.properties
  for insert to authenticated
  with check (user_id = auth.uid());

-- Hindi puwedeng i-verify / i-extend ng owner ang sarili niyang listing
create or replace function public.protect_property_billing()
returns trigger
language plpgsql
as $$
begin
  -- SQL editor / service role (walang auth.uid) at admin ay hindi hinaharangan
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- mamamana lang ang verified status kung verified na ang ibang listing niya
    new.is_verified := exists (
      select 1 from public.properties p
      where p.user_id = auth.uid() and p.is_verified = true
    );
  else
    new.user_id := old.user_id;
    new.is_verified := coalesce(old.is_verified, false) and coalesce(new.is_verified, false);
    new.subscription_date := old.subscription_date;
    new.subscription_expiry := old.subscription_expiry;
    if new.subscription_status is distinct from 'Expired' then
      new.subscription_status := old.subscription_status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_property_billing on public.properties;
create trigger protect_property_billing
  before insert or update on public.properties
  for each row execute function public.protect_property_billing();

-- ============================================================
-- verification_requests (may pangalan, number, email ng owners)
-- ============================================================
drop policy if exists "Allow admins to update requests" on public.verification_requests;
drop policy if exists "Allow admins to view all requests" on public.verification_requests;
drop policy if exists "Allow users to insert their own requests" on public.verification_requests;

alter table public.verification_requests enable row level security;

drop policy if exists "vr_select_own_or_admin" on public.verification_requests;
create policy "vr_select_own_or_admin" on public.verification_requests
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "vr_insert_own" on public.verification_requests;
create policy "vr_insert_own" on public.verification_requests
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "vr_admin_update" on public.verification_requests;
create policy "vr_admin_update" on public.verification_requests
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "vr_admin_delete" on public.verification_requests;
create policy "vr_admin_delete" on public.verification_requests
  for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- storage: avatars — dapat naka-login para makapag-upload
-- ============================================================
drop policy if exists "Public Upload" on storage.objects;
drop policy if exists "Authenticated upload avatars" on storage.objects;
create policy "Authenticated upload avatars" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars');

notify pgrst, 'reload schema';
