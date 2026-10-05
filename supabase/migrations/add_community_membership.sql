-- Budget Rent Community: exclusive, may approval ng superadmin (safe to run more than once)
create table if not exists public.community_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text,
  location text not null default '',
  property_count text not null default '',
  reason text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table public.community_members enable row level security;

create or replace function public.is_community_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in ('admin@budgetrent.ph', 'mendozajakong@gmail.com', 'webnegosyo@budget43.com');
$$;

create or replace function public.is_community_member()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_community_admin()
    or exists (select 1 from public.community_members where user_id = auth.uid() and status = 'approved');
$$;

drop policy if exists "Read own or admin membership" on public.community_members;
create policy "Read own or admin membership" on public.community_members for select to authenticated
  using (user_id = auth.uid() or public.is_community_admin());

-- Ang user lang ang puwedeng mag-apply, laging 'pending' ang simula
drop policy if exists "Apply for membership" on public.community_members;
create policy "Apply for membership" on public.community_members for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

-- Puwedeng ulitin ang application kapag na-reject (balik sa pending)
drop policy if exists "Reapply when rejected" on public.community_members;
create policy "Reapply when rejected" on public.community_members for update to authenticated
  using (user_id = auth.uid() and status = 'rejected')
  with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "Admin manage membership" on public.community_members;
create policy "Admin manage membership" on public.community_members for all to authenticated
  using (public.is_community_admin()) with check (public.is_community_admin());

-- Posts / comments: approved members (at admin) lang
drop policy if exists "Landlords read posts" on public.community_posts;
drop policy if exists "Members read posts" on public.community_posts;
create policy "Members read posts" on public.community_posts for select to authenticated
  using (public.is_community_member());

drop policy if exists "Landlords write posts" on public.community_posts;
drop policy if exists "Members write posts" on public.community_posts;
create policy "Members write posts" on public.community_posts for insert to authenticated
  with check (user_id = auth.uid() and public.is_community_member());

drop policy if exists "Landlords read comments" on public.community_comments;
drop policy if exists "Members read comments" on public.community_comments;
create policy "Members read comments" on public.community_comments for select to authenticated
  using (public.is_community_member());

drop policy if exists "Landlords write comments" on public.community_comments;
drop policy if exists "Members write comments" on public.community_comments;
create policy "Members write comments" on public.community_comments for insert to authenticated
  with check (user_id = auth.uid() and public.is_community_member());

-- Para sa realtime notification kapag na-approve
do $$ begin
  alter publication supabase_realtime add table public.community_members;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
