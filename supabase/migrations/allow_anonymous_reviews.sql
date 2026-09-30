-- Allow tenants to post reviews without signing in.
-- Anonymous reviews have user_id NULL; they can be inserted but not edited/deleted.
alter table public.property_reviews alter column user_id drop not null;

-- Rating cap of 3 stars for new reviews (NOT VALID keeps legacy 4-5 star rows).
alter table public.property_reviews drop constraint if exists property_reviews_rating_max3;
alter table public.property_reviews
  add constraint property_reviews_rating_max3 check (rating between 1 and 3) not valid;

drop policy if exists "Anyone can insert anonymous reviews" on public.property_reviews;
create policy "Anyone can insert anonymous reviews"
  on public.property_reviews for insert
  to anon, authenticated
  with check (user_id is null and rating between 1 and 3);
