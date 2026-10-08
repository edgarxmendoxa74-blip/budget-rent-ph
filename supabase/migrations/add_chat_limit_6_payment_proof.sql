-- 1) Limit ng chat: 6 na mensahe bawat panig (hindi kasama ang auto messages)
-- 2) "Ready for payment" form ng tenant: payment proof image + detalye, lalabas sa chat bilang auto message.
-- Safe to run more than once.

create or replace function public.booking_messages_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.auto then
    return new;
  end if;
  if (select count(*) from public.booking_messages where booking_id = new.booking_id and sender = new.sender and not auto) >= 6 then
    raise exception 'Reply limit reached';
  end if;
  return new;
end;
$$;

create or replace function public.send_guest_message(p_booking_id uuid, p_token uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_body is null or char_length(trim(p_body)) = 0 or char_length(p_body) > 500 then
    raise exception 'Invalid message';
  end if;
  if not exists (
    select 1 from public.booking_requests
    where id = p_booking_id and guest_token is not null and guest_token = p_token
  ) then
    raise exception 'Not allowed';
  end if;
  if (select count(*) from public.booking_messages where booking_id = p_booking_id and sender = 'guest' and not auto) >= 6 then
    raise exception 'Reply limit reached';
  end if;
  insert into public.booking_messages (booking_id, sender, body) values (p_booking_id, 'guest', trim(p_body));
end;
$$;

revoke all on function public.send_guest_message(uuid, uuid, text) from public;
grant execute on function public.send_guest_message(uuid, uuid, text) to anon, authenticated;

alter table public.booking_messages add column if not exists image_url text;

-- Public bucket para makita ng landlord ang proof; ang path ay may random na pangalan
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('booking-payments', 'booking-payments', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "booking_payments_insert" on storage.objects;
create policy "booking_payments_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'booking-payments');

drop policy if exists "booking_payments_read" on storage.objects;
create policy "booking_payments_read" on storage.objects
  for select to public
  using (bucket_id = 'booking-payments');

create or replace function public.submit_payment_proof(
  p_booking_id uuid, p_token uuid, p_name text, p_phone text, p_reference text, p_method text, p_image_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
     or coalesce(trim(p_method), '') = '' or coalesce(p_image_url, '') = '' then
    raise exception 'Invalid payment details';
  end if;
  insert into public.booking_messages (booking_id, sender, body, auto, image_url)
  values (p_booking_id, 'guest',
    left('READY FOR PAYMENT' || E'\nName: ' || trim(p_name) || E'\nPhone: ' || trim(p_phone)
      || E'\nMode of payment: ' || trim(p_method) || E'\nReference no.: ' || trim(p_reference), 500),
    true, p_image_url);
end;
$$;

revoke all on function public.submit_payment_proof(uuid, uuid, text, text, text, text, text) from public;
grant execute on function public.submit_payment_proof(uuid, uuid, text, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
