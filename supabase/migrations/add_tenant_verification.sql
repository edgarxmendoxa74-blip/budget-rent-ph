-- Verified Tenant (₱50 / 1 year): status ng bawat tenant account. Safe to run more than once.
-- Tenant mababasa lang ang sarili niyang row; admin lang ang puwedeng mag-verify (admin_verify_tenant).

create table if not exists public.tenant_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  verified_until timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.tenant_verifications enable row level security;

drop policy if exists tv_select_own_or_admin on public.tenant_verifications;
create policy tv_select_own_or_admin on public.tenant_verifications
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create or replace function public.admin_verify_tenant(p_user uuid, p_months int default 12)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  base timestamptz;
  result timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  if p_months is null or p_months < 1 then
    raise exception 'Invalid months';
  end if;

  -- Kung aktibo pa, idagdag sa natitirang araw
  select greatest(coalesce(verified_until, now()), now()) into base
  from public.tenant_verifications where user_id = p_user;
  result := (coalesce(base, now()) + make_interval(months => p_months));

  insert into public.tenant_verifications (user_id, verified_until, updated_at)
  values (p_user, result, now())
  on conflict (user_id) do update set verified_until = excluded.verified_until, updated_at = now();

  return result;
end;
$$;

revoke all on function public.admin_verify_tenant(uuid, int) from public;
revoke all on function public.admin_verify_tenant(uuid, int) from anon;
grant execute on function public.admin_verify_tenant(uuid, int) to authenticated;

notify pgrst, 'reload schema';
