-- Record ng guest/customer na tumatawag sa owner (pangalan + contact number). Safe to run more than once.
create table if not exists public.customer_inquiries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid,
  owner_email text,
  owner_phone text,
  customer_name text not null check (char_length(customer_name) between 2 and 80),
  customer_phone text not null check (char_length(customer_phone) between 7 and 20),
  action text not null default 'call',
  user_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.customer_inquiries enable row level security;

-- Kahit guest ay puwedeng mag-insert (para sa sarili lang kung naka-login)
drop policy if exists "inquiries_insert" on public.customer_inquiries;
create policy "inquiries_insert" on public.customer_inquiries
  for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

-- Admin, ang owner ng listing, at ang gumawa lang ang puwedeng bumasa
drop policy if exists "inquiries_select" on public.customer_inquiries;
create policy "inquiries_select" on public.customer_inquiries
  for select to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
    or lower(owner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or exists (select 1 from public.properties p where p.id = property_id and p.user_id = auth.uid())
  );

-- Admin lang ang puwedeng mag-delete
drop policy if exists "inquiries_admin_delete" on public.customer_inquiries;
create policy "inquiries_admin_delete" on public.customer_inquiries
  for delete to authenticated
  using (public.is_admin());

notify pgrst, 'reload schema';
