-- Gawing PRIVATE ang payment-proofs (may pangalan / account number ang mga receipt). Safe to run more than once.
-- Ang may-ari (folder = user id niya) at ang admin lang ang makakabasa. Admin: gumagamit ng signed URL sa Managed Plans tab.
update storage.buckets set public = false where id = 'payment-proofs';

drop policy if exists "Public read payment proofs" on storage.objects;
drop policy if exists "Authenticated upload payment proofs" on storage.objects;
drop policy if exists "payment_proofs_insert_own" on storage.objects;
drop policy if exists "payment_proofs_select_own_or_admin" on storage.objects;

create policy "payment_proofs_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "payment_proofs_select_own_or_admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
