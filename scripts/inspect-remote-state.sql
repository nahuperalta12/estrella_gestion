-- Metadata only; does not read business rows.
select 'tables' as section, coalesce(jsonb_agg(table_name order by table_name),'[]'::jsonb) as details from information_schema.tables where table_schema='public' and table_type='BASE TABLE'
union all select 'profile_indexes',coalesce(jsonb_agg(indexdef order by indexname),'[]'::jsonb) from pg_catalog.pg_indexes where schemaname='public' and tablename='profiles'
union all select 'profile_triggers',coalesce(jsonb_agg(pg_catalog.pg_get_triggerdef(t.oid) order by t.tgname),'[]'::jsonb) from pg_catalog.pg_trigger t where t.tgrelid=pg_catalog.to_regclass('public.profiles') and not t.tgisinternal
union all select 'migration_history_table',coalesce(to_jsonb(pg_catalog.to_regclass('supabase_migrations.schema_migrations')::text),'null'::jsonb);
