import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
const count=(value:number)=>Number(value).toLocaleString("es-AR");
const money=(value:number)=>Number(value).toLocaleString("es-AR",{style:"currency",currency:"ARS"});
export async function Dashboard({admin}:{admin:boolean}) {
  const db=await createClient();
  if(admin) {
    const {data,error}=await db.from("dashboard_administration").select("produced,pending,awaiting_receipt,low_stock,active_collaborators,open_orders,agreed_sales_month,cash_income_month,cash_expense_month,owed_collaborators").single();
    if(error || !data) return <section className="tile next"><h2>Indicadores no disponibles</h2><p>Revisá la conexión y las migraciones.</p></section>;
    const stats=[
      ["Plumas producidas",count(data.produced)], ["Pendientes de fabricar",count(data.pending)], ["Terminadas por recibir",count(data.awaiting_receipt)],
      ["Materiales con stock bajo",count(data.low_stock)], ["Colaboradoras activas",count(data.active_collaborators)], ["Pedidos pendientes",count(data.open_orders)],
      ["Ventas pactadas del mes",money(data.agreed_sales_month)], ["Cobros registrados del mes",money(data.cash_income_month)], ["Egresos registrados del mes",money(data.cash_expense_month)],
      ["Pendiente a colaboradoras",money(data.owed_collaborators)],
    ];
    return <section className="next"><h2>Indicadores</h2><p className="muted">Los importes de caja incluyen solo movimientos registrados, incluidas las reversiones compensatorias. Las ventas pactadas no equivalen a cobros ni a rentabilidad.</p><div className="grid">{stats.map(([label,value])=><article className="tile" key={label}><h3>{label}</h3><strong>{value}</strong></article>)}</div></section>;
  }
  const {data,error}=await db.from("dashboard_collaborator").select("pending,produced,produced_month,owed,pending_transfers").single();
  if(error || !data) return <section className="tile next"><h2>Tu resumen no está disponible</h2><p>Revisá la conexión y las migraciones.</p></section>;
  const stats=[["Plumas pendientes",count(data.pending)],["Saldo por cobrar",money(data.owed)],["Producción acumulada",count(data.produced)],["Producción del mes",count(data.produced_month)],["Entregas por confirmar",count(data.pending_transfers)]];
  return <section className="next"><h2>Tu resumen</h2><div className="grid">{stats.map(([label,value])=><article className="tile" key={label}><h3>{label}</h3><strong>{value}</strong></article>)}</div><p><Link href="/produccion">Registrar producción</Link> · <Link href="/entregas">Ver materiales</Link> · <Link href="/remuneraciones">Ver mi dinero</Link></p></section>;
}
