// Isolated behavioral checks; Supabase pgTAP covers RLS on real PostgreSQL.
import {PGlite} from "@electric-sql/pglite";
import {readFile,readdir} from "node:fs/promises";
import assert from "node:assert/strict";

const db=new PGlite();
const admin="a5000000-0000-0000-0000-000000000001";
const worker="a5000000-0000-0000-0000-000000000002";
try {
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  for (const name of (await readdir("supabase/migrations")).filter(n=>n.endsWith(".sql")).sort())
    await db.exec(await readFile(`supabase/migrations/${name}`,"utf8"));
  await db.query("insert into auth.users values ($1,'admin@invalid.test'),($2,'worker@invalid.test')",[admin,worker]);
  await db.query("insert into public.profiles(id,display_name,role,active) values ($1,'Admin','admin',true),($2,'Worker','collaborator',true)",[admin,worker]);
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[admin]);
  const customer=(await db.query("select public.save_customer(null,'Test','',true) as id")).rows[0].id;
  const product=(await db.query("select public.save_product(null,'Feather','','','',100,true) as id")).rows[0].id;
  const other=(await db.query("select public.save_product(null,'Other','','','',100,true) as id")).rows[0].id;
  const order=(await db.query("select public.create_sales_order('a5000000-0000-0000-0000-000000000003',$1,$2,'2026-01-01',null,5,100,'') as id",[customer,product])).rows[0].id;
  await db.query("select public.record_historical_customer_payment('a5000000-0000-0000-0000-000000000004',$1,null,250,'cash','')",[order]);
  await db.query("select public.record_historical_order_delivery('a5000000-0000-0000-0000-000000000005',$1,2,'')",[order]);
  const update=(quantity,price,prod=product,notes="")=>db.query("select public.update_sales_order($1,$2,$3,'2026-01-02',null,$4,$5,$6)",[order,customer,prod,quantity,price,notes]);
  await update(4,100,product," updated ");
  assert.equal((await db.query("select notes from public.sales_orders where id=$1",[order])).rows[0].notes,"updated");
  assert.equal(Number((await db.query("select count(*) as n from public.sales_order_changes")).rows[0].n),1);
  await update(4,100,product,"updated");
  assert.equal(Number((await db.query("select count(*) as n from public.sales_order_changes")).rows[0].n),1);
  await assert.rejects(update(4,60),/order total below payments/);
  await assert.rejects(update(1,300),/order quantity below deliveries/);
  await assert.rejects(update(4,100,other),/order has deliveries/);
  await update(2,125);
  assert.equal((await db.query("select status from public.sales_orders where id=$1",[order])).rows[0].status,"entregado");
  await assert.rejects(update(3,125),/delivered order quantity cannot change/);
  await db.query("select public.save_customer($1,'Test','',false)",[customer]);
  await db.query("select public.save_product($1,'Feather','','','',100,false)",[product]);
  await update(2,125,product,"still valid"); // An inactive existing reference can be retained.
  await db.query("select public.save_customer($1,'Test','',true)",[customer]);
  await db.query("select public.save_product($1,'Feather','','','',100,true)",[product]);
  const second=(await db.query("select public.create_sales_order('a5000000-0000-0000-0000-000000000006',$1,$2,'2026-01-01',null,5,100,'') as id",[customer,product])).rows[0].id;
  const payment=(await db.query("select public.record_historical_customer_payment('a5000000-0000-0000-0000-000000000007',$1,null,250,'cash','') as id",[second])).rows[0].id;
  await db.query("select public.reverse_linked_payment('a5000000-0000-0000-0000-000000000008','customer',$1,'2026-01-02','correction')",[payment]);
  await db.query("select public.update_sales_order($1,$2,$3,'2026-01-02',null,1,100,'')",[second,customer,product]);
  await assert.rejects(db.query("delete from public.sales_order_changes"),/permission denied/);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[worker]);
  await assert.rejects(update(2,125),/access denied/);
  assert.equal(Number((await db.query("select count(*) as n from public.sales_order_changes")).rows[0].n),0);
  console.log("Edición de pedidos: verificaciones aisladas correctas.");
} finally {await db.close();}
