-- Idagdag ang subscription columns sa properties (safe to run more than once)
-- Kailangan ito ng Admin > Verification Request / Managed Plans at ng protect_property_billing trigger
alter table public.properties add column if not exists subscription_status text default 'Regular';
alter table public.properties add column if not exists subscription_date timestamptz;
alter table public.properties add column if not exists subscription_expiry timestamptz;
alter table public.properties add column if not exists login_count int default 0;
alter table public.properties add column if not exists last_login timestamptz;

notify pgrst, 'reload schema';
