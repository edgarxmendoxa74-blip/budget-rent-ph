-- Budget Rent Community: posts + comments ng mga landlord (safe to run more than once)
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Landlord',
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Landlord',
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists community_comments_post_idx on public.community_comments(post_id, created_at);

alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;

-- Landlords (at admin) lang ang puwedeng bumasa / magsulat
drop policy if exists "Landlords read posts" on public.community_posts;
create policy "Landlords read posts" on public.community_posts for select to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'user_role') = 'landlord'
    or lower(auth.jwt() ->> 'email') in ('admin@budgetrent.ph', 'mendozajakong@gmail.com', 'webnegosyo@budget43.com'));

drop policy if exists "Landlords write posts" on public.community_posts;
create policy "Landlords write posts" on public.community_posts for insert to authenticated
  with check (user_id = auth.uid() and (auth.jwt() -> 'user_metadata' ->> 'user_role') = 'landlord');

drop policy if exists "Owner or admin delete posts" on public.community_posts;
create policy "Owner or admin delete posts" on public.community_posts for delete to authenticated
  using (user_id = auth.uid()
    or lower(auth.jwt() ->> 'email') in ('admin@budgetrent.ph', 'mendozajakong@gmail.com', 'webnegosyo@budget43.com'));

drop policy if exists "Landlords read comments" on public.community_comments;
create policy "Landlords read comments" on public.community_comments for select to authenticated
  using ((auth.jwt() -> 'user_metadata' ->> 'user_role') = 'landlord'
    or lower(auth.jwt() ->> 'email') in ('admin@budgetrent.ph', 'mendozajakong@gmail.com', 'webnegosyo@budget43.com'));

drop policy if exists "Landlords write comments" on public.community_comments;
create policy "Landlords write comments" on public.community_comments for insert to authenticated
  with check (user_id = auth.uid() and (auth.jwt() -> 'user_metadata' ->> 'user_role') = 'landlord');

drop policy if exists "Owner or admin delete comments" on public.community_comments;
create policy "Owner or admin delete comments" on public.community_comments for delete to authenticated
  using (user_id = auth.uid()
    or lower(auth.jwt() ->> 'email') in ('admin@budgetrent.ph', 'mendozajakong@gmail.com', 'webnegosyo@budget43.com'));

notify pgrst, 'reload schema';
