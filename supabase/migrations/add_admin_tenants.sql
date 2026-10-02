-- Admin dashboard: listahan ng tenant accounts (galing sa auth.users, na hindi mababasa ng client).
-- Admin lang ang makakagamit (public.is_admin()). Safe to run more than once.

create or replace function public.admin_list_tenants()
returns table (
  id uuid,
  full_name text,
  phone text,
  birthday text,
  work_status text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  bookings bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  return query
  select
    u.id,
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'phone',
    u.raw_user_meta_data ->> 'birthday',
    u.raw_user_meta_data ->> 'work_status',
    u.created_at,
    u.last_sign_in_at,
    (select count(*) from public.booking_requests b where b.user_id = u.id)
  from auth.users u
  -- Ang tenant email ay hango sa phone; hindi lang user_role ang tinitingnan dahil puwede itong baguhin ng user
  where u.email like '%@tenant.budgetrent.ph'
    and u.raw_user_meta_data ->> 'user_role' = 'tenant'
  order by u.created_at desc;
end;
$$;

revoke all on function public.admin_list_tenants() from public;
revoke all on function public.admin_list_tenants() from anon;
grant execute on function public.admin_list_tenants() to authenticated;

notify pgrst, 'reload schema';
