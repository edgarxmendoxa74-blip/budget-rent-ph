-- Admin announcements -> lumalabas sa Notifications ng lahat ng users (safe to run more than once)
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

-- Lahat (kahit hindi naka-login) ay puwedeng bumasa
drop policy if exists "Anyone can read announcements" on public.announcements;
create policy "Anyone can read announcements"
  on public.announcements for select
  to anon, authenticated
  using (true);

-- Admin lang ang puwedeng mag-add / mag-edit / mag-delete (dapat tugma sa src/lib/admin.js)
drop policy if exists "Admins manage announcements" on public.announcements;
create policy "Admins manage announcements"
  on public.announcements for all
  to authenticated
  using (lower(auth.jwt() ->> 'email') in ('admin@budgetrent.ph', 'mendozajakong@gmail.com', 'webnegosyo@budget43.com'))
  with check (lower(auth.jwt() ->> 'email') in ('admin@budgetrent.ph', 'mendozajakong@gmail.com', 'webnegosyo@budget43.com'));

notify pgrst, 'reload schema';
