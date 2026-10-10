-- Landlord "Send refund": after approving, landlord submits refund proof + details; goes to chat as auto message. Safe to run more than once.
alter table public.booking_requests drop constraint if exists booking_requests_refund_status_check;
alter table public.booking_requests
  add constraint booking_requests_refund_status_check check (refund_status in ('requested', 'approved', 'declined', 'sent'));

create or replace function public.send_booking_refund(
  p_booking_id uuid, p_name text, p_phone text, p_reference text, p_method text, p_amount text, p_image_url text)
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
  if b.refund_status is distinct from 'approved' then raise exception 'NOT_APPROVED'; end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_phone), '') = '' or coalesce(trim(p_reference), '') = ''
     or coalesce(trim(p_method), '') = '' or coalesce(trim(p_amount), '') = '' or coalesce(p_image_url, '') = '' then
    raise exception 'Invalid refund details';
  end if;
  update public.booking_requests set refund_status = 'sent', refund_resolved_at = now()
   where id = p_booking_id returning * into b;
  insert into public.booking_messages (booking_id, sender, body, auto, image_url)
  values (p_booking_id, 'owner',
    left('REFUND SENT' || E'\nAmount: ' || trim(p_amount) || E'\nName: ' || trim(p_name) || E'\nPhone: ' || trim(p_phone)
      || E'\nMode of payment: ' || trim(p_method) || E'\nReference no.: ' || trim(p_reference), 500),
    true, p_image_url);
  return b;
end;
$$;

revoke all on function public.send_booking_refund(uuid, text, text, text, text, text, text) from public;
grant execute on function public.send_booking_refund(uuid, text, text, text, text, text, text) to authenticated;
notify pgrst, 'reload schema';
