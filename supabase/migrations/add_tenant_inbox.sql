-- Tenant account Inbox: ang tenant (naka-login) ay nakakabasa at nakakasagot sa chat ng sarili niyang bookings.
-- May limit: 3 mensahe lang bawat panig (tenant at owner) sa bawat booking. Safe to run more than once.

drop policy if exists "bmsg_tenant_select" on public.booking_messages;
create policy "bmsg_tenant_select" on public.booking_messages
  for select to authenticated
  using (
    exists (select 1 from public.booking_requests b where b.id = booking_id and b.user_id = auth.uid())
  );

drop policy if exists "bmsg_tenant_insert" on public.booking_messages;
create policy "bmsg_tenant_insert" on public.booking_messages
  for insert to authenticated
  with check (
    sender = 'guest'
    and exists (select 1 from public.booking_requests b where b.id = booking_id and b.user_id = auth.uid())
  );

-- Markahang nabasa ang mga mensahe ng owner (read_at lang ang puwedeng baguhin; binabantayan ng booking_messages_guard)
drop policy if exists "bmsg_tenant_update" on public.booking_messages;
create policy "bmsg_tenant_update" on public.booking_messages
  for update to authenticated
  using (
    sender = 'owner'
    and exists (select 1 from public.booking_requests b where b.id = booking_id and b.user_id = auth.uid())
  )
  with check (true);

-- Limit na 3 mensahe bawat panig bawat booking (sakop ang direktang insert at ang token RPC)
create or replace function public.booking_messages_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.booking_messages where booking_id = new.booking_id and sender = new.sender) >= 3 then
    raise exception 'Reply limit reached';
  end if;
  return new;
end;
$$;

drop trigger if exists booking_messages_limit on public.booking_messages;
create trigger booking_messages_limit
  before insert on public.booking_messages
  for each row execute function public.booking_messages_limit();

notify pgrst, 'reload schema';
