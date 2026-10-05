-- Dagdag na detalye ng staycation booking mula sa tenant: purpose, sasakyan, payment method, emergency contact.
-- Lahat ay optional. Safe to run more than once.
alter table public.booking_requests
  add column if not exists purpose text check (purpose is null or char_length(purpose) <= 40),
  add column if not exists vehicles int check (vehicles is null or vehicles between 0 and 20),
  add column if not exists payment_method text check (payment_method is null or char_length(payment_method) <= 30),
  add column if not exists emergency_name text check (emergency_name is null or char_length(emergency_name) <= 80),
  add column if not exists emergency_phone text check (emergency_phone is null or char_length(emergency_phone) <= 20);

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
      || coalesce(E'\nOras ng dating: ' || new.arrival_time, '')
      || coalesce(E'\nPurpose: ' || new.purpose, '')
      || case when new.vehicles is not null then E'\nSasakyan: ' || new.vehicles else '' end;
    v_body := 'BOOKING REQUEST (Staycation)' || E'\n' || coalesce(v_title, 'listing') || E'\n\n'
      || v_dates || E'\n' || v_guests || E'\n\n'
      || 'Total: P' || to_char(coalesce(new.total_price, 0), 'FM999,999,990')
      || case when coalesce(new.down_payment, 0) > 0 then E'\nDown payment: P' || to_char(new.down_payment, 'FM999,999,990') else '' end
      || coalesce(E'\nPaano magbabayad: ' || new.payment_method, '');
  else
    v_body := 'INQUIRY (Paupahan)' || E'\n' || coalesce(v_title, 'listing') || E'\n\n'
      || 'Gustong lipat/bisita: ' || to_char(new.check_in, 'Mon DD, YYYY') || E'\n'
      || 'Titira: ' || new.guests || ' katao';
  end if;

  v_body := v_body || E'\n\nPangalan: ' || new.customer_name || E'\nNumber: ' || new.customer_phone;
  if new.emergency_name is not null and new.emergency_phone is not null then
    v_body := v_body || E'\nEmergency: ' || new.emergency_name || ' ' || new.emergency_phone;
  end if;
  if new.note is not null and length(trim(new.note)) > 0 then
    v_body := v_body || E'\nNote: ' || trim(new.note);
  end if;

  insert into public.booking_messages (booking_id, sender, body, auto)
  values (new.id, 'guest', left(v_body, 500), true);
  exception when others then
    raise warning 'auto message failed: %', sqlerrm;
  end;
  return new;
end;
$$;

notify pgrst, 'reload schema';
