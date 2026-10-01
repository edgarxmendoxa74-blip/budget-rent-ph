-- Editable na monthly/yearly subscription plans (presyo at tagal) — admin lang ang puwedeng mag-edit
create table if not exists public.subscription_plans (
  id text primary key check (id in ('monthly', 'yearly')),
  label text not null,
  price numeric not null check (price >= 0),
  months integer not null check (months > 0),
  updated_at timestamptz default now()
);

insert into public.subscription_plans (id, label, price, months) values
  ('monthly', 'Monthly', 20, 1),
  ('yearly', 'Yearly', 100, 12)
on conflict (id) do nothing;

alter table public.subscription_plans enable row level security;

drop policy if exists "plans_public_read" on public.subscription_plans;
create policy "plans_public_read" on public.subscription_plans for select using (true);

drop policy if exists "plans_admin_write" on public.subscription_plans;
create policy "plans_admin_write" on public.subscription_plans
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
