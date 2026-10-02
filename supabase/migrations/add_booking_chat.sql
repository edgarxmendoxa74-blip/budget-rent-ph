-- Rental booking + chat ng tenant at owner. Safe to run more than once.
-- Guest (tenant na walang account) ay kinikilala gamit ang guest_token na naka-save sa device niya.

alter table public.booking_requests
  add column if not exists kind text not null default 'staycation' check (kind in ('staycation', 'rent')),
  add column if not exists guest_token uuid;

-- Rent: isang petsa lang (gustong lipat/pagbisita), kaya puwedeng walang check_out
alter table public.booking_requests alter column check_out drop not null;
alter table public.booking_requests drop constraint if exists booking_requests_check_out_check;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'booking_requests_dates_ok') then
    alter table public.booking_requests
      add constraint booking_requests_dates_ok check (check_out is null or check_out > check_in);
  end if;
end $$;

create index if not exists booking_requests_token_idx on public.booking_requests (guest_token);

-- Guard: overlap check para sa staycation lang; status lang ang puwedeng baguhin ng owner
create or replace function public.booking_requests_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.check_in < current_date then
      raise exception 'Hindi puwedeng mag-book sa nakaraang petsa';
    end if;
    if new.kind = 'staycation' then
      if new.check_out is null then
        raise exception 'Kailangan ang check-out date';
      end if;
      if exists (
        select 1 from public.booking_requests b
        where b.property_id = new.property_id and b.kind = 'staycation' and b.status = 'confirmed'
          and b.check_in < new.check_out and b.check_out > new.check_in
      ) then
        raise exception 'Booked na ang mga petsang ito';
      end if;
    end if;
  else
    if new.property_id <> old.property_id or new.customer_name <> old.customer_name
       or new.customer_phone <> old.customer_phone or new.check_in <> old.check_in
       or new.check_out is distinct from old.check_out or new.guests <> old.guests
       or new.kind <> old.kind or new.guest_token is distinct from old.guest_token
       or new.user_id is distinct from old.user_id then
      raise exception 'Status lang ang puwedeng baguhin';
    end if;
    if new.kind = 'staycation' and new.status = 'confirmed' and old.status <> 'confirmed' and exists (
      select 1 from public.booking_requests b
      where b.property_id = new.property_id and b.kind = 'staycation' and b.status = 'confirmed' and b.id <> new.id
        and b.check_in < new.check_out and b.check_out > new.check_in
    ) then
      raise exception 'May confirmed booking na sa mga petsang ito';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.get_booked_ranges(p_property_id uuid)
returns table (check_in date, check_out date)
language sql
stable
security definer
set search_path = public
as $$
  select b.check_in, b.check_out
  from public.booking_requests b
  where b.property_id = p_property_id and b.kind = 'staycation' and b.status = 'confirmed' and b.check_out >= current_date
  order by b.check_in;
$$;

-- Chat messages ng bawat booking
create table if not exists public.booking_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.booking_requests(id) on delete cascade,
  sender text not null check (sender in ('guest', 'owner')),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists booking_messages_booking_idx on public.booking_messages (booking_id, created_at);

alter table public.booking_messages enable row level security;

-- Owner ng listing (o admin) lang ang direktang nakakabasa/nakakasulat; guest ay sa RPC sa ibaba
drop policy if exists "bmsg_owner_select" on public.booking_messages;
create policy "bmsg_owner_select" on public.booking_messages
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.booking_requests b
      join public.properties p on p.id = b.property_id
      where b.id = booking_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "bmsg_owner_insert" on public.booking_messages;
create policy "bmsg_owner_insert" on public.booking_messages
  for insert to authenticated
  with check (
    sender = 'owner' and (
      public.is_admin()
      or exists (
        select 1 from public.booking_requests b
        join public.properties p on p.id = b.property_id
        where b.id = booking_id and p.user_id = auth.uid()
      )
    )
  );

-- Guest: mga booking niya (gamit ang token na nasa device niya)
create or replace function public.get_guest_bookings(p_tokens uuid[])
returns setof public.booking_requests
language sql
stable
security definer
set search_path = public
as $$
  select * from public.booking_requests
  where guest_token is not null and guest_token = any(p_tokens)
  order by created_at desc
  limit 50;
$$;

create or replace function public.get_guest_messages(p_booking_id uuid, p_token uuid)
returns setof public.booking_messages
language sql
stable
security definer
set search_path = public
as $$
  select m.* from public.booking_messages m
  join public.booking_requests b on b.id = m.booking_id
  where m.booking_id = p_booking_id and b.guest_token is not null and b.guest_token = p_token
  order by m.created_at;
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
  insert into public.booking_messages (booking_id, sender, body) values (p_booking_id, 'guest', trim(p_body));
end;
$$;

revoke all on function public.get_guest_bookings(uuid[]) from public;
revoke all on function public.get_guest_messages(uuid, uuid) from public;
revoke all on function public.send_guest_message(uuid, uuid, text) from public;
grant execute on function public.get_guest_bookings(uuid[]) to anon, authenticated;
grant execute on function public.get_guest_messages(uuid, uuid) to anon, authenticated;
grant execute on function public.send_guest_message(uuid, uuid, text) to anon, authenticated;
grant execute on function public.get_booked_ranges(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
