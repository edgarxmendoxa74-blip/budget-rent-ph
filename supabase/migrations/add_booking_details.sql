-- Dagdag na detalye ng staycation booking (Airbnb-style). Safe to run more than once.
alter table public.booking_requests
  add column if not exists adults int not null default 1 check (adults between 1 and 50),
  add column if not exists children int not null default 0 check (children between 0 and 50),
  add column if not exists pets boolean not null default false,
  add column if not exists arrival_time text check (arrival_time is null or char_length(arrival_time) <= 20),
  add column if not exists customer_email text check (customer_email is null or char_length(customer_email) <= 120),
  add column if not exists total_price numeric not null default 0,
  add column if not exists down_payment numeric not null default 0;

notify pgrst, 'reload schema';
