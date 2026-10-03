-- Listing limit: libre ang 5 listings; may "Pro Listings" plan (hanggang 10) na ina-activate ng admin pagkatapos ng bayad.
-- Safe to run more than once. Requires public.is_admin() (tingnan ang harden_rls_policies.sql).

create table if not exists public.landlord_plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'pro' check (plan in ('pro')),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.landlord_plans enable row level security;

-- Ang landlord ay nakakabasa ng sarili niyang plan; admin lang ang puwedeng sumulat
drop policy if exists "landlord_plans_select" on public.landlord_plans;
create policy "landlord_plans_select" on public.landlord_plans
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "landlord_plans_admin_write" on public.landlord_plans;
create policy "landlord_plans_admin_write" on public.landlord_plans
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 5 kapag walang aktibong plan, 10 kapag meron
create or replace function public.listing_limit(p_user uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.landlord_plans lp where lp.user_id = p_user and lp.expires_at > now()) then 10
    else 5
  end;
$$;

revoke execute on function public.listing_limit(uuid) from public, anon, authenticated;

-- Hindi puwedeng mag-insert ng listing na lampas sa limit (hindi nito ginagalaw ang mga dati nang listing)
create or replace function public.enforce_listing_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null or public.is_admin() then
    return new;
  end if;
  if (select count(*) from public.properties p where p.user_id = new.user_id) >= public.listing_limit(new.user_id) then
    raise exception 'LISTING_LIMIT_REACHED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists properties_listing_limit on public.properties;
create trigger properties_listing_limit
  before insert on public.properties
  for each row execute function public.enforce_listing_limit();

notify pgrst, 'reload schema';
