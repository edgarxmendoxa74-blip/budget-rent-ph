-- Limit na 3 mensahe bawat panig (tenant at landlord) sa chat ng bawat booking. Safe to run more than once.
-- Pinapalitan nito ang dating limit na tenant lang (add_tenant_inbox.sql).

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
