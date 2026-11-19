begin;
select plan(6);
insert into auth.users (id, email) values
  ('30000000-0000-0000-0000-000000000001','supplier-admin@example.test'),
  ('30000000-0000-0000-0000-000000000002','supplier-worker@example.test');
insert into public.profiles (id, display_name, role, active) values
  ('30000000-0000-0000-0000-000000000001','Admin','admin',true),
  ('30000000-0000-0000-0000-000000000002','Worker','collaborator',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.save_supplier(null,'Proveedor de prueba',null,null,null,null,true)$$, 'admin creates supplier');
select is((select count(*) from public.suppliers),1::bigint,'admin can read supplier');
select lives_ok($$select public.save_supplier((select id from public.suppliers limit 1),'Proveedor modificado',null,null,null,null,false)$$, 'admin can update and deactivate');
select throws_ok($$delete from public.suppliers$$,'42501',null,'direct deletion denied');
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000002',true);
select is((select count(*) from public.suppliers),0::bigint,'collaborator cannot read suppliers');
select throws_ok($$select public.save_supplier(null,'No autorizado',null,null,null,null,true)$$,'42501','access denied','collaborator cannot write suppliers');
select * from finish();
rollback;
