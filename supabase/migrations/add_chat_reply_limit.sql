-- Limit ng mensahe ng tenant/guest sa chat ng isang booking: 3 lang. Owner ay walang limit.
-- Safe to run more than once.

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
  if (select count(*) from public.booking_messages where booking_id = p_booking_id and sender = 'guest') >= 3 then
    raise exception 'Reply limit reached';
  end if;
  insert into public.booking_messages (booking_id, sender, body) values (p_booking_id, 'guest', trim(p_body));
end;
$$;

revoke all on function public.send_guest_message(uuid, uuid, text) from public;
grant execute on function public.send_guest_message(uuid, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
