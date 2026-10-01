-- Bucket para sa payment proof ng subscription renewal (public read para mabuksan ng admin ang link sa Messenger)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Authenticated upload payment proofs" on storage.objects;
create policy "Authenticated upload payment proofs" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-proofs');

drop policy if exists "Public read payment proofs" on storage.objects;
create policy "Public read payment proofs" on storage.objects
  for select to public
  using (bucket_id = 'payment-proofs');
