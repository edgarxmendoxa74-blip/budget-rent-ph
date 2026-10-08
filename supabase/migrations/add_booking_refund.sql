-- Refund request ng tenant; aprubahan/tanggihan ng landlord (ang landlord ang nagbabalik ng pera). Safe to run more than once.
alter table public.booking_requests
  add column if not exists refund_status text check (refund_status in ('requested', 'approved', 'declined')),
  add column if not exists refund_reason text,
  add column if not exists refund_requested_at timestamptz,
  add column if not exists refund_resolved_at timestamptz;

create or replace function public.request_booking_refund(p_booking_id uuid, p_reason text)
returns public.booking_requests
language plpgsql security definer set search_path = ''
as $$
declare
  b public.booking_requests;
  uid uuid := auth.uid();
  reason text := left(btrim(coalesce(p_reason, '')), 300);
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if reason = '' then raise exception 'REASON_REQUIRED'; end if;
  select * into b from public.booking_requests where id = p_booking_id for update;
  if not found or b.user_id is distinct from uid then raise exception 'Not allowed'; end if;
  if b.refund_status is not null then raise exception 'REFUND_ALREADY'; end if;
  if not exists (select 1 from public.booking_messages where booking_id = p_booking_id and image_url is not null and not coalesce(deleted_at is not null, false)) then
    raise exception 'NO_PAYMENT';
  end if;
  update public.booking_requests
     set refund_status = 'requested', refund_reason = reason, refund_requested_at = now(), refund_resolved_at = null
   where id = p_booking_id returning * into b;
  insert into public.booking_messages (booking_id, sender, body, auto)
  values (p_booking_id, 'guest', E'Refund requested.\nReason: ' || reason, true);
  return b;
end;
$$;

create or replace function public.resolve_booking_refund(p_booking_id uuid, p_approve boolean)
returns public.booking_requests
language plpgsql security definer set search_path = ''
as $$
declare
  b public.booking_requests;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into b from public.booking_requests where id = p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  if not exists (select 1 from public.properties p where p.id = b.property_id and p.user_id = uid) then raise exception 'Not allowed'; end if;
  if b.refund_status is distinct from 'requested' then raise exception 'NO_REQUEST'; end if;
  update public.booking_requests
     set refund_status = case when p_approve then 'approved' else 'declined' end, refund_resolved_at = now()
   where id = p_booking_id returning * into b;
  insert into public.booking_messages (booking_id, sender, body, auto)
  values (p_booking_id, 'owner', case when p_approve
    then 'Refund confirmed. The landlord will send your refund through your original payment method.'
    else 'Refund request declined.' end, true);
  return b;
end;
$$;

revoke all on function public.request_booking_refund(uuid, text) from public;
revoke all on function public.resolve_booking_refund(uuid, boolean) from public;
grant execute on function public.request_booking_refund(uuid, text) to authenticated;
grant execute on function public.resolve_booking_refund(uuid, boolean) to authenticated;
notify pgrst, 'reload schema';
