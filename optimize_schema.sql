-- Budget Rent PH - Performance Optimization Indexes

-- 1. Index for querying by property type/category
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(type);

-- 2. Index for location-based searches (helps with ILIKE queries if using pg_trgm, but standard btree helps exact matches and ordering)
CREATE INDEX IF NOT EXISTS idx_properties_location ON properties(location);

-- 3. Index for filtering active/verified listings safely
CREATE INDEX IF NOT EXISTS idx_properties_verified ON properties(is_verified);

-- 4. Index for sorting by creation date (used heavily in the app's default fetch order)
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties(created_at DESC);

-- 5. Composite index for verified + active combinations (common filters)
CREATE INDEX IF NOT EXISTS idx_properties_verified_created ON properties(is_verified, created_at DESC);
