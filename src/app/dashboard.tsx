import Link from "next/link";
import {createClient} from "@/lib/supabase/server";
const count=(value:number)=>Number(value).toLocaleString("es-AR");
const money=(value:number)=>Number(value).toLocaleString("es-AR",{style:"currency",currency:"ARS"});
export async function Dashboard({admin}:{admin:boolean}) {
  const db=await createClient();
  if(admin) {
    const [dashboard,cash]=await Promise.all([
      db.from("dashboard_administration").select("produced,pending,awaiting_receipt,low_stock,active_collaborators,open_orders,agreed_sales_month,cash_income_month,cash_expense_month,owed_collaborators").single(),
      db.from("cash_summary").select("income,expense").single(),
    ]);
    const {data,error}=dashboard;
    if(error || !data || cash.error || !cash.data) return <section className="tile next"><h2>Indicadores no disponibles</h2><p>Revisá la conexión y las migraciones.</p></section>;
    const stats=[
      ["Plumas producidas",count(data.produced)], ["Pendientes de fabricar",count(data.pending)], ["Terminadas por recibir",count(data.awaiting_receipt)],
      ["Materiales con stock bajo",count(data.low_stock)], ["Colaboradoras activas",count(data.active_collaborators)], ["Pedidos pendientes",count(data.open_orders)],
      ["Ventas pactadas del mes",money(data.agreed_sales_month)], ["Cobros registrados del mes",money(data.cash_income_month)], ["Egresos registrados del mes",money(data.cash_expense_month)],
      ["Pendiente a colaboradoras",money(data.owed_collaborators)],
    ];
    const income=Number(cash.data.income), expense=Number(cash.data.expense);
    return <>
      <section className="dashboard-summary" aria-labelledby="cash-heading">
        <div className="section-heading"><div><p className="section-kicker">RESUMEN GENERAL</p><h2 id="cash-heading">Caja registrada</h2></div><Link className="section-link" href="/finanzas">Ver movimientos</Link></div>
        <div className="metric-grid"><article className="metric-card metric-income"><span>Ingresos registrados</span><strong>{money(income)}</strong><small>Movimientos de entrada</small></article><article className="metric-card metric-expense"><span>Egresos registrados</span><strong>{money(expense)}</strong><small>Gastos y pagos</small></article><article className="metric-card metric-balance"><span>Diferencia registrada</span><strong>{money(income-expense)}</strong><small>Ingresos menos egresos</small></article></div>
        <p className="summary-note">Acumulado de movimientos de caja registrados, incluidas reversiones. No incluye saldo inicial ni cobros históricos sin fecha; no representa necesariamente el dinero disponible.</p>
      </section>
      <section className="overview-section"><div className="section-heading"><div><p className="section-kicker">EN MARCHA</p><h2>Estado del negocio</h2></div><Link className="section-link" href="/pedidos">Ver pedidos</Link></div><div className="overview-grid"><article className="overview-card"><span>Pedidos pendientes</span><strong>{count(data.open_orders)}</strong></article><article className="overview-card"><span>Pendientes de fabricar</span><strong>{count(data.pending)}</strong></article><article className="overview-card"><span>Materiales con stock bajo</span><strong>{count(data.low_stock)}</strong></article><article className="overview-card"><span>Colaboradoras activas</span><strong>{count(data.active_collaborators)}</strong></article></div>
      <details className="dashboard-details"><summary>Ver más indicadores</summary><div className="grid">{stats.map(([label,value])=><article className="tile" key={label}><h3>{label}</h3><strong>{value}</strong></article>)}</div><p className="summary-note">Las ventas pactadas no equivalen a cobros ni a rentabilidad.</p></details></section>
    </>;
  }
  const {data,error}=await db.from("dashboard_collaborator").select("pending,produced,produced_month,owed,pending_transfers").single();
  if(error || !data) return <section className="tile next"><h2>Tu resumen no está disponible</h2><p>Revisá la conexión y las migraciones.</p></section>;
  const stats=[["Plumas pendientes",count(data.pending)],["Saldo por cobrar",money(data.owed)],["Producción acumulada",count(data.produced)],["Producción del mes",count(data.produced_month)],["Entregas por confirmar",count(data.pending_transfers)]];
  return <section className="next"><h2>Tu resumen</h2><div className="grid">{stats.map(([label,value])=><article className="tile" key={label}><h3>{label}</h3><strong>{value}</strong></article>)}</div><p><Link href="/produccion">Registrar producción</Link> · <Link href="/entregas">Ver materiales</Link> · <Link href="/remuneraciones">Ver mi dinero</Link></p></section>;
}
