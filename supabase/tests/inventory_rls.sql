-- Run only against an isolated local database with pgTAP.
begin;
select plan(9);
insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001','inventory-admin@example.test'),
  ('10000000-0000-0000-0000-000000000002','inventory-worker@example.test');
insert into public.profiles (id, display_name, role, active) values
  ('10000000-0000-0000-0000-000000000001','Admin','admin',true),
  ('10000000-0000-0000-0000-000000000002','Worker','collaborator',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.create_material('Test glue','g',0)$$, 'admin can create material');
select lives_ok($$select public.adjust_warehouse_stock('20000000-0000-0000-0000-000000000001', (select id from public.materials where name='Test glue'), 10, 'initial')$$, 'admin can add stock');
select lives_ok($$select public.adjust_warehouse_stock('20000000-0000-0000-0000-000000000001', (select id from public.materials where name='Test glue'), 10, 'initial')$$, 'same operation can be retried');
select is((select quantity from public.warehouse_balances where material_id=(select id from public.materials where name='Test glue')), 10::numeric, 'retry does not duplicate stock');
select throws_ok($$select public.adjust_warehouse_stock('20000000-0000-0000-0000-000000000002', (select id from public.materials where name='Test glue'), -11, 'out')$$, 'P0001', 'insufficient stock', 'cannot consume unavailable stock');
select is((select count(*) from public.inventory_movements), 1::bigint, 'failed adjustment leaves no movement');
select throws_ok($$update public.warehouse_balances set quantity=100$$, '42501', null, 'direct balance writes denied');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select is((select count(*) from public.materials), 0::bigint, 'collaborator cannot read warehouse catalog');
select throws_ok($$select public.create_material('Forbidden','g',0)$$, '42501', 'access denied', 'collaborator cannot create material');
select * from finish();
rollback;
