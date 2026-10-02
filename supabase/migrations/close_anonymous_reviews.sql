-- Isara ang anonymous reviews: may account lang ang puwedeng mag-review, isa kada listing.
-- Ang UNIQUE (property_id, user_id) ang nagbabawal ng pangalawang review; ang reviews_insert_own ang
-- humihiling ng naka-login na user na hindi may-ari ng listing. Mananatili ang mga lumang anonymous review.
-- Safe to run more than once.

drop policy if exists "Anyone can insert anonymous reviews" on public.property_reviews;

notify pgrst, 'reload schema';
