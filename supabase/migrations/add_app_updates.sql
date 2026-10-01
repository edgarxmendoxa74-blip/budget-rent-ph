-- "Updates" tab: thumbnail + video link para sa bagong updates ng app (safe to run more than once)
create table if not exists public.app_updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  thumbnail_url text,
  video_url text not null,
  created_at timestamptz not null default now()
);

alter table public.app_updates enable row level security;

drop policy if exists "Anyone can read app updates" on public.app_updates;
create policy "Anyone can read app updates"
  on public.app_updates for select
  to anon, authenticated
  using (true);

-- Admin lang ang puwedeng mag-add / mag-edit / mag-delete (dapat tugma sa src/lib/admin.js)
drop policy if exists "Admins manage app updates" on public.app_updates;
create policy "Admins manage app updates"
  on public.app_updates for all
  to authenticated
  using (lower(auth.jwt() ->> 'email') in ('admin@budgetrent.ph', 'mendozajakong@gmail.com', 'webnegosyo@budget43.com'))
  with check (lower(auth.jwt() ->> 'email') in ('admin@budgetrent.ph', 'mendozajakong@gmail.com', 'webnegosyo@budget43.com'));

notify pgrst, 'reload schema';
