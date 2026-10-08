-- Landlord: "Confirm received" sa payment proof message ng tenant/guest. Safe to run more than once.
alter table public.booking_messages add column if not exists confirmed_at timestamptz;

create or replace function public.confirm_payment_received(p_message_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m public.booking_messages;
  uid uuid := auth.uid();
begin
  select * into m from public.booking_messages where id = p_message_id;
  if not found or m.image_url is null or m.sender <> 'guest' then
    raise exception 'Not allowed';
  end if;
  if uid is null or not (
    public.is_admin()
    or exists (select 1 from public.booking_requests b join public.properties p on p.id = b.property_id
               where b.id = m.booking_id and p.user_id = uid)
  ) then
    raise exception 'Not allowed';
  end if;
  update public.booking_messages set confirmed_at = coalesce(confirmed_at, now()) where id = p_message_id;
  -- Natanggap na ang bayad = successful na ang booking (mawawala na ang Successful/Cancel buttons)
  update public.booking_requests
     set outcome = 'successful', outcome_at = now(), outcome_by = 'owner'
   where id = m.booking_id and outcome is null;
end;
$$;

revoke all on function public.confirm_payment_received(uuid) from public;
grant execute on function public.confirm_payment_received(uuid) to authenticated;
notify pgrst, 'reload schema';

-- Para makita ng guest (token) ang status ng booking (hal. successful pagkatapos ma-confirm ang bayad)
create or replace function public.get_guest_booking(p_booking_id uuid, p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', b.id, 'kind', b.kind, 'status', b.status, 'outcome', b.outcome, 'outcome_by', b.outcome_by,
    'outcome_at', b.outcome_at, 'created_at', b.created_at, 'customer_phone', b.customer_phone,
    'payment_method', b.payment_method)
  from public.booking_requests b
  where b.id = p_booking_id and b.guest_token is not null and b.guest_token = p_token;
$$;
revoke all on function public.get_guest_booking(uuid, uuid) from public;
grant execute on function public.get_guest_booking(uuid, uuid) to anon, authenticated;
notify pgrst, 'reload schema';
