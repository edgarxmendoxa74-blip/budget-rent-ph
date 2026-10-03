-- Shared app settings (hal. payment methods + QR na ina-upload ng super admin).
-- Public ang basa (kailangan makita ng lahat ng user ang "Show where to pay"); admin lang ang puwedeng magsulat.
-- Safe to run more than once.

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings
  for select to anon, authenticated
  using (true);

drop policy if exists app_settings_admin_insert on public.app_settings;
create policy app_settings_admin_insert on public.app_settings
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists app_settings_admin_update on public.app_settings;
create policy app_settings_admin_update on public.app_settings
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists app_settings_admin_delete on public.app_settings;
create policy app_settings_admin_delete on public.app_settings
  for delete to authenticated
  using (public.is_admin());

notify pgrst, 'reload schema';
