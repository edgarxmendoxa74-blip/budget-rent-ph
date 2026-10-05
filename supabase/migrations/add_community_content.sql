-- Budget Rent Community: videos, events at valuable content na ang admin lang ang nagpo-post
-- + bilang ng members na nakikita ng lahat ng members (safe to run more than once)
create table if not exists public.community_content (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'content' check (kind in ('video', 'event', 'content')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 2000),
  video_url text,
  event_date timestamptz,
  created_at timestamptz not null default now()
);

alter table public.community_content enable row level security;

drop policy if exists "Members read content" on public.community_content;
create policy "Members read content" on public.community_content for select to authenticated
  using (public.is_community_member());

drop policy if exists "Admin manage content" on public.community_content;
create policy "Admin manage content" on public.community_content for all to authenticated
  using (public.is_community_admin()) with check (public.is_community_admin());

-- Bilang lang ang ibinabalik (hindi ang personal details), para makita ng members
create or replace function public.community_member_count()
returns integer language sql stable security definer set search_path = public as $$
  select case when public.is_community_member()
    then (select count(*)::int from public.community_members where status = 'approved')
    else 0 end;
$$;
grant execute on function public.community_member_count() to authenticated;

notify pgrst, 'reload schema';
