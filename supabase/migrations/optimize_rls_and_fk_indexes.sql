-- Performance: i-wrap ang auth.uid()/auth.jwt() sa (select ...) para isang beses lang i-evaluate
-- kada query (hindi kada row). Pareho ang logic ng bawat policy. Safe to run more than once.

-- announcements / app_updates
alter policy "Admins manage announcements" on public.announcements
  using (lower(((select auth.jwt()) ->> 'email')) = any (array['admin@budgetrent.ph', 'mendozajakong@gmail.com', 'webnegosyo@budget43.com']))
  with check (lower(((select auth.jwt()) ->> 'email')) = any (array['admin@budgetrent.ph', 'mendozajakong@gmail.com', 'webnegosyo@budget43.com']));

alter policy "Admins manage app updates" on public.app_updates
  using (lower(((select auth.jwt()) ->> 'email')) = any (array['admin@budgetrent.ph', 'mendozajakong@gmail.com', 'webnegosyo@budget43.com']))
  with check (lower(((select auth.jwt()) ->> 'email')) = any (array['admin@budgetrent.ph', 'mendozajakong@gmail.com', 'webnegosyo@budget43.com']));

-- booking_dismissals
alter policy "dismissals_select_own" on public.booking_dismissals
  using (user_id = (select auth.uid()));

alter policy "dismissals_delete_own" on public.booking_dismissals
  using (user_id = (select auth.uid()));

alter policy "dismissals_insert_own" on public.booking_dismissals
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.booking_requests b
      where b.id = booking_dismissals.booking_id
        and b.status = any (array['confirmed', 'declined'])
    )
  );

-- booking_messages
alter policy "bmsg_owner_select" on public.booking_messages
  using (
    public.is_admin() or exists (
      select 1 from public.booking_requests b
      join public.properties p on p.id = b.property_id
      where b.id = booking_messages.booking_id and p.user_id = (select auth.uid())
    )
  );

alter policy "bmsg_owner_insert" on public.booking_messages
  with check (
    sender = 'owner' and (
      public.is_admin() or exists (
        select 1 from public.booking_requests b
        join public.properties p on p.id = b.property_id
        where b.id = booking_messages.booking_id and p.user_id = (select auth.uid())
      )
    )
  );

alter policy "bmsg_owner_update" on public.booking_messages
  using (
    public.is_admin() or exists (
      select 1 from public.booking_requests b
      join public.properties p on p.id = b.property_id
      where b.id = booking_messages.booking_id and p.user_id = (select auth.uid())
    )
  );

alter policy "bmsg_tenant_select" on public.booking_messages
  using (
    exists (
      select 1 from public.booking_requests b
      where b.id = booking_messages.booking_id and b.user_id = (select auth.uid())
    )
  );

alter policy "bmsg_tenant_insert" on public.booking_messages
  with check (
    sender = 'guest' and exists (
      select 1 from public.booking_requests b
      where b.id = booking_messages.booking_id and b.user_id = (select auth.uid())
    )
  );

alter policy "bmsg_tenant_update" on public.booking_messages
  using (
    sender = 'owner' and exists (
      select 1 from public.booking_requests b
      where b.id = booking_messages.booking_id and b.user_id = (select auth.uid())
    )
  );

-- booking_requests
alter policy "booking_insert" on public.booking_requests
  with check (status = 'pending' and (user_id is null or user_id = (select auth.uid())));

alter policy "booking_select" on public.booking_requests
  using (
    public.is_admin()
    or user_id = (select auth.uid())
    or exists (
      select 1 from public.properties p
      where p.id = booking_requests.property_id and p.user_id = (select auth.uid())
    )
  );

alter policy "booking_owner_update" on public.booking_requests
  using (
    public.is_admin() or exists (
      select 1 from public.properties p
      where p.id = booking_requests.property_id and p.user_id = (select auth.uid())
    )
  )
  with check (
    public.is_admin() or exists (
      select 1 from public.properties p
      where p.id = booking_requests.property_id and p.user_id = (select auth.uid())
    )
  );

-- customer_inquiries
alter policy "inquiries_insert" on public.customer_inquiries
  with check (user_id is null or user_id = (select auth.uid()));

alter policy "inquiries_select" on public.customer_inquiries
  using (
    public.is_admin()
    or user_id = (select auth.uid())
    or lower(owner_email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
    or exists (
      select 1 from public.properties p
      where p.id = customer_inquiries.property_id and p.user_id = (select auth.uid())
    )
  );

-- properties
alter policy "Allow individual delete" on public.properties
  using ((select auth.uid()) = user_id);

alter policy "Allow individual update" on public.properties
  using ((select auth.uid()) = user_id);

alter policy "insert_own_properties_v2" on public.properties
  with check (user_id = (select auth.uid()));

-- property_reviews
alter policy "reviews_delete_own" on public.property_reviews
  using (user_id = (select auth.uid()));

alter policy "reviews_update_own" on public.property_reviews
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "reviews_insert_own" on public.property_reviews
  with check (
    (select auth.uid()) is not null
    and user_id = (select auth.uid())
    and not exists (
      select 1 from public.properties p
      where p.id = property_reviews.property_id and p.user_id = (select auth.uid())
    )
  );

-- verification_requests
alter policy "vr_insert_own" on public.verification_requests
  with check (user_id = (select auth.uid()) and status = 'pending');

alter policy "vr_select_own_or_admin" on public.verification_requests
  using (user_id = (select auth.uid()) or public.is_admin());

-- Indexes para sa foreign keys na wala pang index
create index if not exists properties_user_id_idx on public.properties (user_id);
create index if not exists property_reviews_user_id_idx on public.property_reviews (user_id);
create index if not exists verification_requests_user_id_idx on public.verification_requests (user_id);
