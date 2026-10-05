-- QR image sa payment methods ng landlord at limit na 2 bawat landlord. Safe to run more than once.
alter table public.payment_methods
  add column if not exists qr_url text check (qr_url is null or char_length(qr_url) <= 500);

create or replace function public.payment_methods_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.payment_methods where user_id = new.user_id) >= 2 then
    raise exception 'Maximum of 2 payment methods';
  end if;
  return new;
end;
$$;

drop trigger if exists payment_methods_limit on public.payment_methods;
create trigger payment_methods_limit
  before insert on public.payment_methods
  for each row execute function public.payment_methods_limit();

drop function if exists public.get_booking_payment_methods(uuid, uuid);
create or replace function public.get_booking_payment_methods(p_booking_id uuid, p_token uuid default null)
returns table (id uuid, provider text, account_name text, account_number text, notes text, qr_url text)
language sql
stable
security definer
set search_path = public
as $$
  select pm.id, pm.provider, pm.account_name, pm.account_number, pm.notes, pm.qr_url
  from public.booking_requests b
  join public.properties p on p.id = b.property_id
  join public.payment_methods pm on pm.user_id = p.user_id
  where b.id = p_booking_id
    and (
      (p_token is not null and b.guest_token is not null and b.guest_token = p_token)
      or b.user_id = auth.uid()
      or p.user_id = auth.uid()
    )
  order by pm.created_at;
$$;

revoke all on function public.get_booking_payment_methods(uuid, uuid) from public;
grant execute on function public.get_booking_payment_methods(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
