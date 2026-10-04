-- Push notifications (FCM): device tokens + triggers na tumatawag sa Edge Function "send-push"
create extension if not exists pg_net;

create table if not exists public.device_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'android',
  updated_at timestamptz not null default now()
);
create index if not exists device_tokens_user_idx on public.device_tokens(user_id);

alter table public.device_tokens enable row level security;
drop policy if exists "own tokens select" on public.device_tokens;
drop policy if exists "own tokens insert" on public.device_tokens;
drop policy if exists "own tokens update" on public.device_tokens;
drop policy if exists "own tokens delete" on public.device_tokens;
create policy "own tokens select" on public.device_tokens for select to authenticated using (user_id = auth.uid());
create policy "own tokens insert" on public.device_tokens for insert to authenticated with check (user_id = auth.uid());
create policy "own tokens update" on public.device_tokens for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own tokens delete" on public.device_tokens for delete to authenticated using (user_id = auth.uid());

-- Private config (walang policy = walang access sa app; service role lang). Random ang secret, hindi nasa code.
create table if not exists public.push_config (key text primary key, value text not null);
alter table public.push_config enable row level security;
insert into public.push_config (key, value)
  values ('push_secret', encode(extensions.gen_random_bytes(24), 'hex'))
  on conflict (key) do nothing;

create or replace function public.notify_push() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare secret text;
begin
  select value into secret from public.push_config where key = 'push_secret';
  perform net.http_post(
    url := 'https://utdarqyhkiexotouqjkz.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret),
    body := jsonb_build_object('type', tg_argv[0], 'record', to_jsonb(new))
  );
  return new;
exception when others then
  return new; -- huwag harangin ang pag-save kapag pumalya ang push
end $$;

drop trigger if exists push_on_announcement on public.announcements;
create trigger push_on_announcement after insert on public.announcements
  for each row execute function public.notify_push('announcement');
drop trigger if exists push_on_booking on public.booking_requests;
create trigger push_on_booking after insert on public.booking_requests
  for each row execute function public.notify_push('booking');
drop trigger if exists push_on_message on public.booking_messages;
create trigger push_on_message after insert on public.booking_messages
  for each row execute function public.notify_push('message');

-- Para sa phone na nag-switch ng account: ililipat ang token sa kasalukuyang user (hindi kaya ng RLS lang)
create or replace function public.register_device_token(p_token text, p_platform text default 'android')
returns void language sql security definer set search_path = public as $$
  insert into public.device_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), coalesce(p_platform, 'android'), now())
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, updated_at = now()
  where auth.uid() is not null;
$$;
revoke all on function public.register_device_token(text, text) from public, anon;
grant execute on function public.register_device_token(text, text) to authenticated;
