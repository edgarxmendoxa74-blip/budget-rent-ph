-- Dagdag na "Payment for" (down payment, deposit, etc.) sa Ready for payment form. Safe to run more than once.
drop function if exists public.submit_payment_proof(uuid, uuid, text, text, text, text, text);

create or replace function public.submit_payment_proof(
  p_booking_id uuid, p_token uuid, p_name text, p_phone text, p_reference text, p_method text, p_image_url text, p_purpose text)
returns void language plpgsql security definer set search_path = public as $$
declare
  b public.booking_requests;
  uid uuid := auth.uid();
begin
  select * into b from public.booking_requests where id = p_booking_id;
  if not found or not (
    (uid is not null and b.user_id = uid)
    or (p_token is not null and b.guest_token is not null and b.guest_token = p_token)
  ) then
    raise exception 'Not allowed';
  end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_phone), '') = '' or coalesce(trim(p_reference), '') = ''
     or coalesce(trim(p_method), '') = '' or coalesce(trim(p_purpose), '') = '' or coalesce(p_image_url, '') = '' then
    raise exception 'Invalid payment details';
  end if;
  insert into public.booking_messages (booking_id, sender, body, auto, image_url)
  values (p_booking_id, 'guest',
    left('READY FOR PAYMENT' || E'
Payment for: ' || trim(p_purpose) || E'
Name: ' || trim(p_name) || E'
Phone: ' || trim(p_phone)
      || E'
Mode of payment: ' || trim(p_method) || E'
Reference no.: ' || trim(p_reference), 500),
    true, p_image_url);
end;
$$;

revoke all on function public.submit_payment_proof(uuid, uuid, text, text, text, text, text, text) from public;
grant execute on function public.submit_payment_proof(uuid, uuid, text, text, text, text, text, text) to anon, authenticated;
notify pgrst, 'reload schema';
