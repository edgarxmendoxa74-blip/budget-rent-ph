-- Payment methods ng landlord (GCash, Maya, bank, etc.). Safe to run more than once.
-- Ang landlord lang ang nakakapag-edit; ang tenant ay nakakakita lang sa chat ng booking niya (via RPC).

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (char_length(provider) between 1 and 40),
  account_name text not null check (char_length(account_name) between 1 and 80),
  account_number text not null check (char_length(account_number) between 1 and 40),
  notes text check (notes is null or char_length(notes) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists payment_methods_user_idx on public.payment_methods (user_id);

alter table public.payment_methods enable row level security;

drop policy if exists "pm_owner_all" on public.payment_methods;
create policy "pm_owner_all" on public.payment_methods
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Tenant: payment methods ng landlord ng booking na iyon (token guest o naka-login na tenant)
create or replace function public.get_booking_payment_methods(p_booking_id uuid, p_token uuid default null)
returns table (id uuid, provider text, account_name text, account_number text, notes text)
language sql
stable
security definer
set search_path = public
as $$
  select pm.id, pm.provider, pm.account_name, pm.account_number, pm.notes
  from public.booking_requests b
  join public.properties p on p.id = b.property_id
  join public.payment_methods pm on pm.user_id = p.user_id
  where b.id = p_booking_id
    and (
      (p_token is not null and b.guest_token is not null and b.guest_token = p_token)
      or b.user_id = auth.uid()
      or p.user_id = auth.uid()
    )
  order by pm.created_at;
$$;

revoke all on function public.get_booking_payment_methods(uuid, uuid) from public;
grant execute on function public.get_booking_payment_methods(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
