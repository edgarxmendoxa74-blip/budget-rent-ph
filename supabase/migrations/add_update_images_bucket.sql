-- Storage bucket para sa image upload ng Updates dashboard (safe to run more than once)
insert into storage.buckets (id, name, public)
values ('update-images', 'update-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone can view update images" on storage.objects;
create policy "Anyone can view update images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'update-images');

-- Admin lang ang puwedeng mag-upload / mag-delete (dapat tugma sa src/lib/admin.js)
drop policy if exists "Admins manage update images" on storage.objects;
create policy "Admins manage update images"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'update-images' and lower(auth.jwt() ->> 'email') in ('admin@budgetrent.ph', 'mendozajakong@gmail.com', 'webnegosyo@budget43.com'))
  with check (bucket_id = 'update-images' and lower(auth.jwt() ->> 'email') in ('admin@budgetrent.ph', 'mendozajakong@gmail.com', 'webnegosyo@budget43.com'));
