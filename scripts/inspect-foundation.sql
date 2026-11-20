-- Read-only metadata for comparing the deployed foundation with migration 001.
select 'columns' as section, coalesce(jsonb_agg(jsonb_build_object('name',a.attname,'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid)) order by a.attnum),'[]'::jsonb) as details
from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
where a.attrelid=pg_catalog.to_regclass('public.profiles') and a.attnum>0 and not a.attisdropped
union all
select 'constraints',coalesce(jsonb_agg(jsonb_build_object('name',c.conname,'definition',pg_catalog.pg_get_constraintdef(c.oid)) order by c.conname),'[]'::jsonb) from pg_catalog.pg_constraint c where c.conrelid=pg_catalog.to_regclass('public.profiles')
union all
select 'policies',coalesce(jsonb_agg(jsonb_build_object('name',policyname,'command',cmd,'roles',roles,'using',qual,'check',with_check) order by policyname),'[]'::jsonb) from pg_catalog.pg_policies where schemaname='public' and tablename='profiles'
union all
select 'function',coalesce(jsonb_agg(jsonb_build_object('definition',pg_catalog.pg_get_functiondef(p.oid),'acl',p.proacl)),'[]'::jsonb) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='is_active_admin' and p.pronargs=0
union all
select 'table_security',coalesce(jsonb_agg(jsonb_build_object('rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl)),'[]'::jsonb) from pg_catalog.pg_class c where c.oid=pg_catalog.to_regclass('public.profiles')
union all
select 'roles',coalesce(jsonb_agg(e.enumlabel order by e.enumsortorder),'[]'::jsonb) from pg_catalog.pg_enum e where e.enumtypid=pg_catalog.to_regtype('public.app_role');
