-- "Burahin" sa Inbox (tenant) at Bookings (landlord) para sa confirmed at declined na booking.
-- Itinatago lang ito sa listahan ng gumawa ng aksyon; hindi nabubura ang booking, kaya buo pa rin ang record ng kabilang panig
-- at hindi nababalik na available ang mga petsa. Safe to run more than once.

create table if not exists public.booking_dismissals (
  booking_id uuid not null references public.booking_requests(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (booking_id, user_id)
);

alter table public.booking_dismissals enable row level security;

drop policy if exists "dismissals_select_own" on public.booking_dismissals;
create policy "dismissals_select_own" on public.booking_dismissals
  for select to authenticated using (user_id = auth.uid());

-- Booking na nakikita lang ng user (RLS ng booking_requests) ang puwede niyang itago, at confirmed o declined lang
drop policy if exists "dismissals_insert_own" on public.booking_dismissals;
create policy "dismissals_insert_own" on public.booking_dismissals
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.booking_requests b where b.id = booking_id and b.status in ('confirmed', 'declined'))
  );

-- Puwedeng ibalik sa listahan
drop policy if exists "dismissals_delete_own" on public.booking_dismissals;
create policy "dismissals_delete_own" on public.booking_dismissals
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, delete on public.booking_dismissals to authenticated;

notify pgrst, 'reload schema';
