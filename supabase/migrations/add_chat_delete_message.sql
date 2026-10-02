-- Delete ng sariling mensahe sa booking chat (soft delete). Safe to run more than once.
-- Nananatili ang row (kaya bilang pa rin sa 3-mensahe limit); binubura lang ang laman at nilalagyan ng deleted_at.
-- Dumadaan sa delete_chat_message() para hindi kailangang luwagan ang RLS at hindi mapalitan ang laman ng mensahe ng iba.

alter table public.booking_messages add column if not exists deleted_at timestamptz;

-- Dating read_at lang ang puwedeng baguhin; ngayon puwede rin ang body/deleted_at pero sa delete_chat_message() lang
create or replace function public.booking_messages_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.id <> old.id or new.booking_id <> old.booking_id or new.sender <> old.sender
     or new.created_at <> old.created_at then
    raise exception 'read_at lang ang puwedeng baguhin';
  end if;
  if (new.body <> old.body or new.deleted_at is distinct from old.deleted_at)
     and coalesce(current_setting('app.chat_delete', true), '') <> '1' then
    raise exception 'read_at lang ang puwedeng baguhin';
  end if;
  return new;
end;
$$;

create or replace function public.delete_chat_message(p_message_id uuid, p_token uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.booking_messages;
  b public.booking_requests;
  uid uuid := auth.uid();
  allowed boolean := false;
begin
  select * into m from public.booking_messages where id = p_message_id;
  if not found or m.auto or m.deleted_at is not null then
    raise exception 'Not allowed';
  end if;
  select * into b from public.booking_requests where id = m.booking_id;

  if m.sender = 'owner' then
    allowed := uid is not null and (
      public.is_admin()
      or exists (select 1 from public.properties p where p.id = b.property_id and p.user_id = uid)
    );
  else
    allowed := (uid is not null and b.user_id = uid)
      or (p_token is not null and b.guest_token is not null and b.guest_token = p_token);
  end if;
  if not allowed then
    raise exception 'Not allowed';
  end if;

  perform set_config('app.chat_delete', '1', true);
  update public.booking_messages
  set deleted_at = now(), body = 'Na-delete ang mensahe'
  where id = p_message_id;
end;
$$;

revoke all on function public.delete_chat_message(uuid, uuid) from public;
grant execute on function public.delete_chat_message(uuid, uuid) to anon, authenticated;

notify pgrst, 'reload schema';
