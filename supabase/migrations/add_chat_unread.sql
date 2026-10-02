-- Unread badge at realtime ng booking chat. Safe to run more than once.
alter table public.booking_messages add column if not exists read_at timestamptz;

-- Owner (o admin) lang ang puwedeng mag-update, at read_at lang ang puwedeng baguhin
drop policy if exists "bmsg_owner_update" on public.booking_messages;
create policy "bmsg_owner_update" on public.booking_messages
  for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.booking_requests b
      join public.properties p on p.id = b.property_id
      where b.id = booking_id and p.user_id = auth.uid()
    )
  )
  with check (true);

create or replace function public.booking_messages_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id <> old.id or new.booking_id <> old.booking_id or new.sender <> old.sender
     or new.body <> old.body or new.created_at <> old.created_at then
    raise exception 'read_at lang ang puwedeng baguhin';
  end if;
  return new;
end;
$$;

drop trigger if exists booking_messages_guard on public.booking_messages;
create trigger booking_messages_guard
  before update on public.booking_messages
  for each row execute function public.booking_messages_guard();

-- Guest: markahang nabasa ang mga mensahe ng owner
create or replace function public.mark_guest_read(p_booking_id uuid, p_token uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.booking_messages m
  set read_at = now()
  from public.booking_requests b
  where m.booking_id = b.id and b.id = p_booking_id
    and b.guest_token is not null and b.guest_token = p_token
    and m.sender = 'owner' and m.read_at is null;
$$;

-- Guest: ilang hindi pa nababasang mensahe ng owner kada booking
create or replace function public.get_guest_unread(p_tokens uuid[])
returns table (booking_id uuid, unread bigint)
language sql
stable
security definer
set search_path = public
as $$
  select m.booking_id, count(*)
  from public.booking_messages m
  join public.booking_requests b on b.id = m.booking_id
  where b.guest_token is not null and b.guest_token = any(p_tokens)
    and m.sender = 'owner' and m.read_at is null
  group by m.booking_id;
$$;

revoke all on function public.mark_guest_read(uuid, uuid) from public;
revoke all on function public.get_guest_unread(uuid[]) from public;
grant execute on function public.mark_guest_read(uuid, uuid) to anon, authenticated;
grant execute on function public.get_guest_unread(uuid[]) to anon, authenticated;

-- Realtime para sa owner (sumusunod sa RLS)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'booking_messages'
  ) then
    alter publication supabase_realtime add table public.booking_messages;
  end if;
end $$;

notify pgrst, 'reload schema';
