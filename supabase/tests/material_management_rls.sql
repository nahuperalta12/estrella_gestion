-- Run only against an isolated database with pgTAP.
begin;
select plan(8);
insert into auth.users (id, email) values
  ('40000000-0000-0000-0000-000000000001','materials-admin@example.test'),
  ('40000000-0000-0000-0000-000000000002','materials-worker@example.test');
insert into public.profiles (id, display_name, role, active) values
  ('40000000-0000-0000-0000-000000000001','Admin','admin',true),
  ('40000000-0000-0000-0000-000000000002','Worker','collaborator',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000001',true);
select public.create_material('Material editable','g',0);
select lives_ok($$select public.update_material((select id from public.materials where name='Material editable'),'Material actualizado',2.5,false)$$, 'admin can update and deactivate');
select is((select minimum_stock from public.materials where name='Material actualizado'), 2.5::numeric, 'minimum saved');
select is((select active from public.materials where name='Material actualizado'), false, 'inactive state saved');
select throws_ok($$select public.adjust_warehouse_stock('40000000-0000-0000-0000-000000000003',(select id from public.materials where name='Material actualizado'),1,'test')$$, 'P0001', 'material not found or inactive', 'inactive material cannot be adjusted');
select lives_ok($$select public.update_material((select id from public.materials where name='Material actualizado'),'Material actualizado',2.5,true)$$, 'admin can reactivate');
select throws_ok($$select public.update_material((select id from public.materials where name='Material actualizado'),'Material actualizado',0.0001,true)$$, 'P0001', 'invalid material', 'reject excessive precision');
select throws_ok($$update public.materials set name='Direct write'$$, '42501', null, 'direct writes denied');
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000002',true);
select throws_ok($$select public.update_material('40000000-0000-0000-0000-000000000004','Forbidden',0,true)$$, '42501', 'access denied', 'collaborator cannot update');
select * from finish();
rollback;
