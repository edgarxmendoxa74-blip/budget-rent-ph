-- Booking outcome: "Successful booking" o "Cancelled booking" (para sa chat buttons at landlord analytics).
-- Rules (naka-enforce dito, hindi lang sa app):
--   * Landlord (owner ng property): puwedeng mag-mark ng successful o cancelled.
--   * Tenant (nag-book): puwedeng mag-mark ng successful; puwedeng mag-cancel hanggang 7 araw lang mula nang mag-book.
--   * Isang beses lang ma-set ang outcome. Kapag cancelled, nagiging 'declined' ang status para bumalik ang petsa.
-- Safe to run more than once.

alter table public.booking_requests add column if not exists outcome text;
alter table public.booking_requests add column if not exists outcome_at timestamptz;
alter table public.booking_requests add column if not exists outcome_by text;

alter table public.booking_requests drop constraint if exists booking_requests_outcome_check;
alter table public.booking_requests add constraint booking_requests_outcome_check
  check (outcome is null or outcome in ('successful', 'cancelled'));

create or replace function public.set_booking_outcome(p_booking_id uuid, p_outcome text)
returns public.booking_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.booking_requests;
  uid uuid := auth.uid();
  is_owner boolean;
  is_tenant boolean;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;
  if p_outcome not in ('successful', 'cancelled') then
    raise exception 'Invalid outcome';
  end if;

  select * into b from public.booking_requests where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found';
  end if;
  if b.outcome is not null then
    raise exception 'ALREADY_SET';
  end if;

  select exists (select 1 from public.properties p where p.id = b.property_id and p.user_id = uid) into is_owner;
  is_tenant := (b.user_id is not null and b.user_id = uid);

  if not is_owner and not is_tenant then
    raise exception 'Not allowed';
  end if;

  -- Tenant (hindi owner): cancel hanggang 7 araw lang
  if p_outcome = 'cancelled' and not is_owner and now() > b.created_at + interval '7 days' then
    raise exception 'CANCEL_WINDOW_PASSED';
  end if;

  update public.booking_requests
     set outcome = p_outcome,
         outcome_at = now(),
         outcome_by = case when is_owner then 'owner' else 'tenant' end,
         status = case when p_outcome = 'cancelled' then 'declined' else status end
   where id = p_booking_id
   returning * into b;

  return b;
end;
$$;

revoke all on function public.set_booking_outcome(uuid, text) from public;
revoke all on function public.set_booking_outcome(uuid, text) from anon;
grant execute on function public.set_booking_outcome(uuid, text) to authenticated;

notify pgrst, 'reload schema';
