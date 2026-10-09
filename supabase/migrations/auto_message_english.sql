-- Ang awtomatikong unang mensahe sa booking chat (staycation at rent inquiry) ay nasa English na. Safe to run more than once.
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
  v_nights int;
begin
  begin
  select coalesce(to_jsonb(p) ->> 'name', to_jsonb(p) ->> 'title', 'listing') into v_title
  from public.properties p where p.id = new.property_id;

  if new.kind = 'staycation' then
    v_nights := new.check_out - new.check_in;
    v_dates := 'Check-in: ' || to_char(new.check_in, 'Mon DD, YYYY')
      || E'\nCheck-out: ' || to_char(new.check_out, 'Mon DD, YYYY')
      || ' (' || v_nights || case when v_nights = 1 then ' night)' else ' nights)' end;
    v_guests := 'Guests: ' || new.guests || ' (' || new.adults || case when new.adults = 1 then ' adult, ' else ' adults, ' end
      || new.children || case when new.children = 1 then ' child)' else ' children)' end
      || E'\nPets: ' || case when new.pets then 'Yes' else 'No' end
      || coalesce(E'\nArrival time: ' || new.arrival_time, '')
      || coalesce(E'\nPurpose: ' || new.purpose, '')
      || case when new.vehicles is not null then E'\nVehicles: ' || new.vehicles else '' end;
    v_body := 'BOOKING REQUEST (Staycation)' || E'\n' || coalesce(v_title, 'listing') || E'\n\n'
      || v_dates || E'\n' || v_guests || E'\n\n'
      || 'Total: P' || to_char(coalesce(new.total_price, 0), 'FM999,999,990')
      || case when coalesce(new.down_payment, 0) > 0 then E'\nDown payment: P' || to_char(new.down_payment, 'FM999,999,990') else '' end
      || coalesce(E'\nPayment method: ' || new.payment_method, '');
  else
    v_body := 'INQUIRY (Rental)' || E'\n' || coalesce(v_title, 'listing') || E'\n\n'
      || 'Preferred move-in / visit date: ' || to_char(new.check_in, 'Mon DD, YYYY') || E'\n'
      || 'Number of people staying: ' || new.guests;
  end if;

  v_body := v_body || E'\n\nName: ' || new.customer_name || E'\nPhone: ' || new.customer_phone;
  if new.emergency_name is not null and new.emergency_phone is not null then
    v_body := v_body || E'\nEmergency contact: ' || new.emergency_name || ' ' || new.emergency_phone;
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
