// Isolated smoke test; run Supabase pgTAP separately for full integration coverage.
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
try {
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;`);
  for (const name of (await readdir('supabase/migrations')).filter(n => n.endsWith('.sql')).sort()) await db.exec(await readFile(`supabase/migrations/${name}`, 'utf8'));
  await db.exec(`insert into auth.users(id,email) values ('e0000000-0000-0000-0000-000000000001','admin@test.invalid'),('e0000000-0000-0000-0000-000000000002','worker@test.invalid');
    insert into public.profiles(id,display_name,role,active) values ('e0000000-0000-0000-0000-000000000001','Admin','admin',true),('e0000000-0000-0000-0000-000000000002','Worker','collaborator',true);
    insert into public.customers(id,name) values ('e0000000-0000-0000-0000-000000000003','Customer');
    insert into public.products(id,name) values ('e0000000-0000-0000-0000-000000000004','Product');
    insert into public.sales_orders(id,operation_key,customer_id,product_id,ordered_on,quantity,unit_price,actor_id) values ('e0000000-0000-0000-0000-000000000005','e0000000-0000-0000-0000-000000000006','e0000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000004','2026-01-01',4,100,'e0000000-0000-0000-0000-000000000001');
    set role authenticated; select set_config('request.jwt.claim.sub','e0000000-0000-0000-0000-000000000001',false);`);
  const query=(sql)=>db.query(sql);
  const dated="select public.record_historical_customer_payment('e0000000-0000-0000-0000-000000000007','e0000000-0000-0000-0000-000000000005','2026-01-01',100,'Desconocido','Fecha provisoria')";
  const undated="select public.record_historical_customer_payment('e0000000-0000-0000-0000-000000000008','e0000000-0000-0000-0000-000000000005',null,100,'Desconocido','Fecha desconocida')";
  await query(dated); await query(undated); await query(undated);
  assert.equal(Number((await query('select paid from public.sales_order_payment_progress')).rows[0].paid),200);
  assert.equal((await query('select count(*)::int as n from public.customer_payments')).rows[0].n,2);
  assert.equal((await query('select notes from public.financial_transactions')).rows[0].notes,'Fecha provisoria');
  assert.equal((await query('select count(*)::int as n from public.financial_transactions')).rows[0].n,1);
  await assert.rejects(query("select public.record_customer_payment('e0000000-0000-0000-0000-000000000008','e0000000-0000-0000-0000-000000000005','2026-01-01',100,'Desconocido','Fecha desconocida')"),/operation key already used/);
  await assert.rejects(query(undated.replace('null,100',"'2026-01-01',100")),/operation key already used/);
  const delivery="select public.record_historical_order_delivery('e0000000-0000-0000-0000-000000000009','e0000000-0000-0000-0000-000000000005',2,'Fecha desconocida')";
  await query(delivery); await query(delivery);
  assert.equal(Number((await query('select delivered from public.order_delivery_progress')).rows[0].delivered),2);
  assert.equal(Number((await query('select delivered from public.finished_stock')).rows[0].delivered),0);
  await assert.rejects(query("select public.deliver_order('e0000000-0000-0000-0000-000000000009','e0000000-0000-0000-0000-000000000005','2026-01-01',2,'Fecha desconocida')"),/operation key already used/);
  await assert.rejects(query("select public.deliver_order('e0000000-0000-0000-0000-000000000010','e0000000-0000-0000-0000-000000000005','2026-01-01',1,'')"),/insufficient finished stock/);
  await query("select public.reverse_linked_payment('e0000000-0000-0000-0000-000000000011','customer',(select id from public.customer_payments where paid_on is null),'2026-01-02','Correccion')");
  assert.equal(Number((await query('select paid from public.sales_order_payment_progress')).rows[0].paid),100);
  assert.equal((await query('select count(*)::int as n from public.financial_transactions')).rows[0].n,1);
  await query("select set_config('request.jwt.claim.sub','e0000000-0000-0000-0000-000000000002',false)");
  await assert.rejects(query(undated),/access denied/); await assert.rejects(query(delivery),/access denied/);
  console.log('Pruebas aisladas de historial superadas.');
} finally { await db.close(); }
