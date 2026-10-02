-- Staycation booking requests (kailan/ilan/sino). Ang owner ang nagko-confirm o nagdi-decline.
-- Safe to run more than once.
create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  owner_email text,
  customer_name text not null check (char_length(customer_name) between 2 and 80),
  customer_phone text not null check (char_length(customer_phone) between 7 and 20),
  check_in date not null,
  check_out date not null,
  guests int not null default 1 check (guests between 1 and 50),
  note text check (note is null or char_length(note) <= 200),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'declined')),
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (check_out > check_in)
);

create index if not exists booking_requests_property_idx on public.booking_requests (property_id, check_in, check_out);

alter table public.booking_requests enable row level security;

-- Kahit guest ay puwedeng mag-request (pending lang, at para sa sarili lang kung naka-login)
drop policy if exists "booking_insert" on public.booking_requests;
create policy "booking_insert" on public.booking_requests
  for insert to anon, authenticated
  with check (status = 'pending' and (user_id is null or user_id = auth.uid()));

-- Admin, ang owner ng listing, at ang gumawa lang ang puwedeng bumasa
drop policy if exists "booking_select" on public.booking_requests;
create policy "booking_select" on public.booking_requests
  for select to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
    or exists (select 1 from public.properties p where p.id = property_id and p.user_id = auth.uid())
  );

-- Ang owner ng listing (o admin) lang ang puwedeng mag-confirm/decline
drop policy if exists "booking_owner_update" on public.booking_requests;
create policy "booking_owner_update" on public.booking_requests
  for update to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.properties p where p.id = property_id and p.user_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.properties p where p.id = property_id and p.user_id = auth.uid())
  );

drop policy if exists "booking_admin_delete" on public.booking_requests;
create policy "booking_admin_delete" on public.booking_requests
  for delete to authenticated
  using (public.is_admin());

-- Bawal mag-overlap sa confirmed booking; status lang ang puwedeng baguhin ng owner
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
    if exists (
      select 1 from public.booking_requests b
      where b.property_id = new.property_id and b.status = 'confirmed'
        and b.check_in < new.check_out and b.check_out > new.check_in
    ) then
      raise exception 'Booked na ang mga petsang ito';
    end if;
  else
    if new.property_id <> old.property_id or new.customer_name <> old.customer_name
       or new.customer_phone <> old.customer_phone or new.check_in <> old.check_in
       or new.check_out <> old.check_out or new.guests <> old.guests
       or new.user_id is distinct from old.user_id then
      raise exception 'Status lang ang puwedeng baguhin';
    end if;
    if new.status = 'confirmed' and old.status <> 'confirmed' and exists (
      select 1 from public.booking_requests b
      where b.property_id = new.property_id and b.status = 'confirmed' and b.id <> new.id
        and b.check_in < new.check_out and b.check_out > new.check_in
    ) then
      raise exception 'May confirmed booking na sa mga petsang ito';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists booking_requests_guard on public.booking_requests;
create trigger booking_requests_guard
  before insert or update on public.booking_requests
  for each row execute function public.booking_requests_guard();

-- Petsa lang ang ibinabalik (walang pangalan o number) para makita ng lahat kung alin ang booked na
create or replace function public.get_booked_ranges(p_property_id uuid)
returns table (check_in date, check_out date)
language sql
stable
security definer
set search_path = public
as $$
  select b.check_in, b.check_out
  from public.booking_requests b
  where b.property_id = p_property_id and b.status = 'confirmed' and b.check_out >= current_date
  order by b.check_in;
$$;

revoke all on function public.get_booked_ranges(uuid) from public;
grant execute on function public.get_booked_ranges(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
