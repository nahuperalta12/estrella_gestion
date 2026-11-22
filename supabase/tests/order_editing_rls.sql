begin;
select plan(15);
insert into auth.users(id,email) values
  ('a4000000-0000-0000-0000-000000000001','edit-admin@example.test'),
  ('a4000000-0000-0000-0000-000000000002','edit-worker@example.test');
insert into public.profiles(id,display_name,role,active) values
  ('a4000000-0000-0000-0000-000000000001','Admin','admin',true),
  ('a4000000-0000-0000-0000-000000000002','Worker','collaborator',true);
insert into public.customers(id,name,active) values
  ('a4000000-0000-0000-0000-000000000003','Client',true),
  ('a4000000-0000-0000-0000-000000000004','Inactive',false);
insert into public.products(id,name,active) values
  ('a4000000-0000-0000-0000-000000000005','Product',true),
  ('a4000000-0000-0000-0000-000000000006','Other product',true);
insert into public.sales_orders(id,operation_key,customer_id,product_id,ordered_on,quantity,unit_price,actor_id) values
  ('a4000000-0000-0000-0000-000000000007','a4000000-0000-0000-0000-000000000008',
   'a4000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000005','2026-01-01',5,100,'a4000000-0000-0000-0000-000000000001');
insert into public.customer_payments(id,operation_key,order_id,paid_on,amount,method,actor_id) values
  ('a4000000-0000-0000-0000-000000000009','a4000000-0000-0000-0000-000000000010',
   'a4000000-0000-0000-0000-000000000007','2026-01-01',250,'cash','a4000000-0000-0000-0000-000000000001');
insert into public.order_deliveries(id,operation_key,order_id,quantity,actor_id,affects_stock) values
  ('a4000000-0000-0000-0000-000000000011','a4000000-0000-0000-0000-000000000012',
   'a4000000-0000-0000-0000-000000000007',2,'a4000000-0000-0000-0000-000000000001',false);
set local role authenticated;
select set_config('request.jwt.claim.sub','a4000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.update_sales_order('a4000000-0000-0000-0000-000000000007','a4000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000005','2026-01-02','2026-02-01',4,100,' updated ')$$,'admin edits order');
select is((select quantity from public.sales_orders where id='a4000000-0000-0000-0000-000000000007'),4,'new quantity saved');
select is((select notes from public.sales_orders where id='a4000000-0000-0000-0000-000000000007'),'updated','notes trimmed');
select is((select count(*) from public.sales_order_changes),1::bigint,'change audited');
select throws_ok($$select public.update_sales_order('a4000000-0000-0000-0000-000000000007','a4000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000005','2026-01-02',null,4,60,'')$$,'P0001','order total below payments','cannot reduce total below active payments');
select throws_ok($$select public.update_sales_order('a4000000-0000-0000-0000-000000000007','a4000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000005','2026-01-02',null,1,300,'')$$,'P0001','order quantity below deliveries','historical deliveries count');
select throws_ok($$select public.update_sales_order('a4000000-0000-0000-0000-000000000007','a4000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000006','2026-01-02',null,4,100,'')$$,'P0001','order has deliveries','cannot reassign delivered product');
select throws_ok($$select public.update_sales_order('a4000000-0000-0000-0000-000000000007','a4000000-0000-0000-0000-000000000004','a4000000-0000-0000-0000-000000000005','2026-01-02',null,4,100,'')$$,'P0001','customer or product inactive','cannot select inactive customer');
select throws_ok($$select public.update_sales_order('a4000000-0000-0000-0000-000000000007','a4000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000005','2026-01-02',null,4,1.001,'')$$,'P0001','invalid order','fractional cents rejected');
select lives_ok($$select public.update_sales_order('a4000000-0000-0000-0000-000000000007','a4000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000005','2026-01-02',null,2,125,'')$$,'setting quantity to delivered closes the order');
select is((select status from public.sales_orders where id='a4000000-0000-0000-0000-000000000007'),'entregado','full delivery status preserved');
select throws_ok($$select public.update_sales_order('a4000000-0000-0000-0000-000000000007','a4000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000005','2026-01-02',null,3,125,'')$$,'P0001','delivered order quantity cannot change','delivered order cannot reopen silently');
select throws_ok($$update public.sales_order_changes set actor_id='a4000000-0000-0000-0000-000000000002'$$,'42501',null,'audit records cannot be rewritten');
select set_config('request.jwt.claim.sub','a4000000-0000-0000-0000-000000000002',true);
select throws_ok($$select public.update_sales_order('a4000000-0000-0000-0000-000000000007','a4000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000005','2026-01-02',null,2,125,'')$$,'42501','access denied','worker cannot edit');
select is((select count(*) from public.sales_order_changes),0::bigint,'worker cannot read audit');
select * from finish();
rollback;
