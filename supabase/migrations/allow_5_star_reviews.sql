-- Raise the review rating cap from 3 to 5 stars.
alter table public.property_reviews drop constraint if exists property_reviews_rating_max3;
alter table public.property_reviews drop constraint if exists property_reviews_rating_max5;
alter table public.property_reviews
  add constraint property_reviews_rating_max5 check (rating between 1 and 5) not valid;

drop policy if exists "Anyone can insert anonymous reviews" on public.property_reviews;
create policy "Anyone can insert anonymous reviews"
  on public.property_reviews for insert
  to anon, authenticated
  with check (user_id is null and rating between 1 and 5);
