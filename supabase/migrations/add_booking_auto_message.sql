-- Kapag may bagong booking request (staycation o rent), awtomatikong may unang mensahe sa chat na may detalye ng booking.
-- Hindi ito binibilang sa limit na 3 mensahe ng tenant. Safe to run more than once.

alter table public.booking_messages add column if not exists auto boolean not null default false;

-- Limit na 3 bawat panig; hindi kasama ang awtomatikong mensahe
create or replace function public.booking_messages_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.auto then
    return new;
  end if;
  if (select count(*) from public.booking_messages where booking_id = new.booking_id and sender = new.sender and not auto) >= 3 then
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
  if (select count(*) from public.booking_messages where booking_id = p_booking_id and sender = 'guest' and not auto) >= 3 then
    raise exception 'Reply limit reached';
  end if;
  insert into public.booking_messages (booking_id, sender, body) values (p_booking_id, 'guest', trim(p_body));
end;
$$;

revoke all on function public.send_guest_message(uuid, uuid, text) from public;
grant execute on function public.send_guest_message(uuid, uuid, text) to anon, authenticated;

-- Gumagawa ng unang mensahe mula sa booking details
create or replace function public.booking_requests_auto_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body text;
  v_dates text;
  v_guests text;
begin
  begin
  select coalesce(to_jsonb(p) ->> 'name', to_jsonb(p) ->> 'title', 'listing') into v_title
  from public.properties p where p.id = new.property_id;

  if new.kind = 'staycation' then
    v_dates := 'Check-in: ' || to_char(new.check_in, 'Mon DD, YYYY')
      || E'\nCheck-out: ' || to_char(new.check_out, 'Mon DD, YYYY')
      || ' (' || (new.check_out - new.check_in) || ' gabi)';
    v_guests := 'Guests: ' || new.guests || ' (' || new.adults || ' adult, ' || new.children || ' bata)'
      || E'\nAlaga: ' || case when new.pets then 'Oo' else 'Wala' end
      || coalesce(E'\nOras ng dating: ' || new.arrival_time, '');
    v_body := 'BOOKING REQUEST (Staycation)' || E'\n' || coalesce(v_title, 'listing') || E'\n\n'
      || v_dates || E'\n' || v_guests || E'\n\n'
      || 'Total: P' || to_char(coalesce(new.total_price, 0), 'FM999,999,990')
      || case when coalesce(new.down_payment, 0) > 0 then E'\nDown payment: P' || to_char(new.down_payment, 'FM999,999,990') else '' end;
  else
    v_body := 'INQUIRY (Paupahan)' || E'\n' || coalesce(v_title, 'listing') || E'\n\n'
      || 'Gustong lipat/bisita: ' || to_char(new.check_in, 'Mon DD, YYYY') || E'\n'
      || 'Titira: ' || new.guests || ' katao';
  end if;

  v_body := v_body || E'\n\nPangalan: ' || new.customer_name || E'\nNumber: ' || new.customer_phone;
  if new.note is not null and length(trim(new.note)) > 0 then
    v_body := v_body || E'\nNote: ' || trim(new.note);
  end if;

  insert into public.booking_messages (booking_id, sender, body, auto)
  values (new.id, 'guest', left(v_body, 500), true);
  exception when others then
    -- Hindi dapat mabigo ang booking dahil lang sa awtomatikong mensahe
    raise warning 'auto message failed: %', sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists booking_requests_auto_message on public.booking_requests;
create trigger booking_requests_auto_message
  after insert on public.booking_requests
  for each row execute function public.booking_requests_auto_message();

notify pgrst, 'reload schema';
