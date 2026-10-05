-- Realtime sa listings: makikita agad ng tenant ang edits ng landlord. Safe to run more than once.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'properties') then
    alter publication supabase_realtime add table public.properties;
  end if;
end $$;
