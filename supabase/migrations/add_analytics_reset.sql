-- "Reset data" sa landlord Analytics: itinatala lang kung kailan nag-reset; hindi nabubura ang mga booking. Safe to run more than once.
create table if not exists public.analytics_resets (
  user_id uuid primary key default auth.uid(),
  reset_at timestamptz not null default now()
);
alter table public.analytics_resets enable row level security;
drop policy if exists "analytics_resets_own" on public.analytics_resets;
create policy "analytics_resets_own" on public.analytics_resets
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.analytics_resets to authenticated;
notify pgrst, 'reload schema';
