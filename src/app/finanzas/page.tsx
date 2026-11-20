import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {CashForm,ReverseCashForm} from "./form";
export const dynamic="force-dynamic";
const money=(value:number)=>Number(value).toLocaleString("es-AR",{style:"currency",currency:"ARS"});
export default async function FinancePage() {
  const db=await createClient(); const {data:{user}}=await db.auth.getUser(); if(!user) redirect("/ingresar");
  const {data:profile}=await db.from("profiles").select("role,active").eq("id",user.id).maybeSingle(); if(!profile?.active || profile.role!=="admin") redirect("/");
  const [summary,transactions]=await Promise.all([db.from("cash_summary").select("income,expense").single(),db.from("financial_transactions").select("id,occurred_on,direction,amount,category,notes,operation_key,reversal_of").order("created_at",{ascending:false}).limit(100)]);
  if(summary.error || transactions.error || !summary.data) return <main className="content"><Link href="/">← Inicio</Link><h1>Caja no disponible</h1><p>Revisá la conexión y las migraciones.</p></main>;
  const ids=(transactions.data ?? []).filter(t=>t.operation_key && !t.reversal_of).map(t=>t.id);
  const reversals=ids.length ? await db.from("financial_transactions").select("reversal_of").in("reversal_of",ids) : {data:[],error:null};
  if(reversals.error) return <main className="content"><Link href="/">← Inicio</Link><h1>Caja no disponible</h1><p>No se pudo consultar el estado de las reversiones.</p></main>;
  const date=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Argentina/Buenos_Aires",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  return <main className="content"><Link href="/">← Inicio</Link><h1>Caja registrada</h1><p className="muted">Los totales incluyen movimientos compensatorios de reversión. No incluye automáticamente un saldo inicial ni movimientos anteriores a su registro. Revertí los pagos y cobros vinculados desde su módulo de origen; los movimientos manuales se revierten aquí.</p><div className="grid"><article className="tile"><h2>Ingresos registrados</h2><p>{money(summary.data.income)}</p></article><article className="tile"><h2>Egresos registrados</h2><p>{money(summary.data.expense)}</p></article><article className="tile"><h2>Diferencia registrada</h2><p>{money(Number(summary.data.income)-Number(summary.data.expense))}</p></article></div><CashForm date={date} operationKey={crypto.randomUUID()}/><section className="next"><h2>Últimos movimientos</h2>{!transactions.data?.length && <p>No hay movimientos registrados.</p>}{transactions.data?.map(t=>{const reversed=reversals.data?.some(r=>r.reversal_of===t.id);return <article className="tile" key={t.id}><p>{t.occurred_on} · {t.category} · {t.direction==="income" ? "Ingreso":"Egreso"} {money(t.amount)} {t.reversal_of ? "· Reversión" : reversed ? "· Revertido" : ""}</p>{t.notes && <p>{t.notes}</p>}{t.operation_key && !t.reversal_of && !reversed && <ReverseCashForm id={t.id} date={date} operationKey={crypto.randomUUID()}/>}</article>;})}</section></main>;
}
