// Run against PGlite, never against a real database. The SQL file remains local.
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";

const [sqlPath, actor] = process.argv.slice(2);
if (!sqlPath || !actor) throw new Error("Uso: node scripts/test-importacion-2027.mjs archivo.sql uuid-administrador");
const db = new PGlite();
try {
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;`);
  for (const name of (await readdir("supabase/migrations")).filter(n => n.endsWith(".sql")).sort())
    await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
  await db.query("insert into auth.users (id,email) values ($1,'admin@test.invalid')", [actor]);
  await db.query("insert into public.profiles(id,display_name,role,active) values ($1,'Admin','admin',true)", [actor]);
  const sql = await readFile(sqlPath, "utf8");
  const match = sql.match(/decode\('([A-Za-z0-9+/=]+)', 'base64'\)/);
  assert.ok(match, "Falta el manifiesto codificado en el SQL");
  const payload = JSON.parse(Buffer.from(match[1], "base64").toString("utf8"));
  const invalidPayload = structuredClone(payload);
  invalidPayload.expenses.at(-1).importe = "0"; // Fail after all orders and preceding expenses.
  const invalidSql = sql.replace(match[1], Buffer.from(JSON.stringify(invalidPayload)).toString("base64"));
  await assert.rejects(db.exec(invalidSql));
  await db.exec("rollback");
  assert.equal((await db.query("select count(*)::int as n from public.sales_orders")).rows[0].n, 0);
  assert.equal((await db.query("select count(*)::int as n from public.customers")).rows[0].n, 0);
  assert.equal((await db.query("select count(*)::int as n from public.financial_transactions")).rows[0].n, 0);
  await db.exec(sql);
  await db.exec(sql); // A retry must not duplicate any row.
  const result = (await db.query(`select
    (select count(*)::int from public.sales_orders) as orders,
    (select coalesce(sum(quantity * unit_price),0)::numeric from public.sales_orders) as agreed,
    (select count(*)::int from public.customer_payments) as payments,
    (select coalesce(sum(amount),0)::numeric from public.customer_payments) as paid,
    (select count(*)::int from public.customer_payments where paid_on is null) as undated_payments,
    (select count(*)::int from public.order_deliveries) as deliveries,
    (select count(*)::int from public.order_deliveries where delivered_on is null) as undated_deliveries,
    (select coalesce(sum(delivered),0)::int from public.finished_stock) as stock_delivered,
    (select count(*)::int from public.financial_transactions where direction='expense') as expenses,
    (select coalesce(sum(amount),0)::numeric from public.financial_transactions where direction='expense') as expenses_amount,
    (select coalesce(sum(amount),0)::numeric from public.financial_transactions where direction='income') as dated_income,
    (select count(*)::int from public.financial_transactions where direction='income' and notes like '%fecha provisoria%') as provisional_income`)).rows[0];
  const orders = payload.orders;
  const deposits = orders.filter(o => Number(o.sena) > 0);
  const balances = orders.filter(o => o.saldo_adicional_confirmado);
  const deliveries = orders.filter(o => o.entregado_original === "SI");
  const total = (items, fn) => items.reduce((sum, item) => sum + Number(fn(item)), 0);
  assert.equal(result.orders, orders.length);
  assert.equal(Number(result.agreed), total(orders, o => o.total_calculado));
  assert.equal(result.payments, deposits.length + balances.length);
  assert.equal(Number(result.paid), total(deposits, o => o.sena) + total(balances, o => o.saldo_adicional_confirmado.importe));
  assert.equal(result.undated_payments, balances.filter(o => !o.saldo_adicional_confirmado.fecha).length);
  assert.equal(result.deliveries, deliveries.length);
  assert.equal(result.undated_deliveries, deliveries.length);
  assert.equal(result.stock_delivered, 0);
  assert.equal(result.expenses, payload.expenses.length);
  assert.equal(Number(result.expenses_amount), total(payload.expenses, e => e.importe));
  assert.equal(Number(result.dated_income), total(deposits, o => o.sena) + total(balances.filter(o => o.saldo_adicional_confirmado.fecha), o => o.saldo_adicional_confirmado.importe));
  assert.equal(result.provisional_income, deposits.length);
  console.log("Importación aislada y repetición verificadas; no se accedió a Supabase.");
} finally {
  await db.close();
}
