-- Pagkalipas ng 7 araw mula sa booking, hindi na puwedeng i-cancel (tenant at landlord). Safe to run more than once.
create or replace function public.set_booking_outcome(p_booking_id uuid, p_outcome text)
returns public.booking_requests
language plpgsql security definer set search_path = ''
as $$
declare
  b public.booking_requests;
  uid uuid := auth.uid();
  is_owner boolean;
  is_tenant boolean;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if p_outcome not in ('successful', 'cancelled') then raise exception 'Invalid outcome'; end if;
  select * into b from public.booking_requests where id = p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  if b.outcome is not null then raise exception 'ALREADY_SET'; end if;
  select exists (select 1 from public.properties p where p.id = b.property_id and p.user_id = uid) into is_owner;
  is_tenant := (b.user_id is not null and b.user_id = uid);
  if not is_owner and not is_tenant then raise exception 'Not allowed'; end if;
  if p_outcome = 'cancelled' and now() > b.created_at + interval '7 days' then
    raise exception 'CANCEL_WINDOW_PASSED';
  end if;
  if p_outcome = 'cancelled' and exists (
    select 1 from public.booking_messages m where m.booking_id = p_booking_id and m.image_url is not null and m.deleted_at is null
  ) then
    raise exception 'PAYMENT_SENT';
  end if;
  update public.booking_requests
     set outcome = p_outcome, outcome_at = now(),
         outcome_by = case when is_owner then 'owner' else 'tenant' end,
         status = case when p_outcome = 'cancelled' then 'declined' else status end
   where id = p_booking_id
   returning * into b;
  return b;
end;
$$;
