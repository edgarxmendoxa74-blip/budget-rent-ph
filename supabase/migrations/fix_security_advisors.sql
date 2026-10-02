-- Ayos sa Supabase security advisor warnings. Safe to run more than once.

-- 1) Huwag nang "with check (true)" sa UPDATE policies ng booking_messages.
--    Pareho na lang sa USING para hindi mailipat ang row sa booking na hindi sa iyo.
--    (Binabantayan pa rin ng booking_messages_guard na read_at lang ang puwedeng baguhin.)
alter policy "bmsg_owner_update" on public.booking_messages
  with check (
    public.is_admin() or exists (
      select 1 from public.booking_requests b
      join public.properties p on p.id = b.property_id
      where b.id = booking_messages.booking_id and p.user_id = (select auth.uid())
    )
  );

alter policy "bmsg_tenant_update" on public.booking_messages
  with check (
    sender = 'owner' and exists (
      select 1 from public.booking_requests b
      where b.id = booking_messages.booking_id and b.user_id = (select auth.uid())
    )
  );

-- 2) Trigger function lang ito; hindi dapat matawag bilang RPC. Tatakbo pa rin ang trigger.
revoke all on function public.booking_requests_auto_message() from public, anon, authenticated;

notify pgrst, 'reload schema';
