import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {CashForm,ReverseCashForm} from "./form";

export const dynamic="force-dynamic";
const money=(value:number)=>Number(value).toLocaleString("es-AR",{style:"currency",currency:"ARS"});
const formatDate=(value:string)=>value.split("-").reverse().join("/");
const pageSize=50;
type SearchParams={tipo?:string; pagina?:string};

export default async function FinancePage({searchParams}:{searchParams:Promise<SearchParams>}) {
  const params=await searchParams;
  const type=params.tipo === "ingresos" || params.tipo === "egresos" ? params.tipo : "todos";
  const requestedPage=Number(params.pagina);
  const page=Number.isSafeInteger(requestedPage) && requestedPage>0 ? requestedPage : 1;
  const href=(selectedType:string,selectedPage=1)=>`/finanzas?tipo=${selectedType}&pagina=${selectedPage}`;
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user) redirect("/ingresar");
  const {data:profile}=await db.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
  if(!profile?.active || profile.role!=="admin") redirect("/");

  let query=db.from("financial_transactions").select("id,occurred_on,direction,amount,category,notes,operation_key,reversal_of",{count:"exact"});
  if(type!=="todos") query=query.eq("direction",type==="ingresos" ? "income" : "expense");
  const [summary,transactions]=await Promise.all([
    db.from("cash_summary").select("income,expense").single(),
    query.order("occurred_on",{ascending:false}).order("id",{ascending:false}).range((page-1)*pageSize,page*pageSize-1),
  ]);
  if(summary.error || transactions.error || !summary.data) return <main className="content"><Link href="/">← Inicio</Link><h1>Caja no disponible</h1><p>Revisá la conexión y las migraciones.</p></main>;
  const ids=(transactions.data ?? []).filter(t=>!t.reversal_of).map(t=>t.id);
  const reversals=ids.length ? await db.from("financial_transactions").select("reversal_of").in("reversal_of",ids) : {data:[],error:null};
  if(reversals.error) return <main className="content"><Link href="/">← Inicio</Link><h1>Caja no disponible</h1><p>No se pudo consultar el estado de las reversiones.</p></main>;
  const date=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Argentina/Buenos_Aires",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const total=transactions.count ?? 0;
  const pageCount=Math.max(1,Math.ceil(total/pageSize));

  return <main className="content">
    <Link href="/">← Inicio</Link>
    <h1>Ingresos y gastos</h1>
    <p className="muted">Consultá los movimientos registrados y la diferencia entre ingresos y egresos.</p>
    <div className="metric-grid">
      <article className="metric-card"><h2>Ingresos registrados</h2><strong>{money(summary.data.income)}</strong></article>
      <article className="metric-card"><h2>Egresos registrados</h2><strong>{money(summary.data.expense)}</strong></article>
      <article className="metric-card"><h2>Diferencia registrada</h2><strong>{money(Number(summary.data.income)-Number(summary.data.expense))}</strong></article>
    </div>
    <p className="muted">Los totales incluyen reversiones y movimientos con fecha. No incluyen cobros históricos sin fecha, saldo inicial ni movimientos anteriores a su registro.</p>
    <section className="table-panel">
      <div className="table-toolbar"><div><h2>Movimientos</h2><p className="muted">{total} {total===1 ? "movimiento" : "movimientos"} · ordenados por fecha más reciente</p></div>
        <details className="action-disclosure"><summary>+ Registrar ingreso o gasto</summary><CashForm date={date} operationKey={crypto.randomUUID()}/></details>
      </div>
      <nav aria-label="Filtrar movimientos por tipo" className="table-toolbar">
        {[["todos","Todos"],["ingresos","Ingresos"],["egresos","Gastos"]].map(([value,label])=><Link key={value} href={href(value)} aria-current={type===value ? "page" : undefined}>{type===value ? <strong>{label}</strong> : label}</Link>)}
      </nav>
      {transactions.data?.length ? <div className="table-wrap"><table className="data-table" style={{minWidth:850}}><thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Importe</th><th>Observaciones</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
        {transactions.data.map(t=>{const reversed=reversals.data?.some(r=>r.reversal_of===t.id);return <tr key={t.id}><td>{formatDate(t.occurred_on)}</td><td>{t.category==="Pago a colaboradora" ? "Pago a colaborador" : t.category}</td><td>{t.direction==="income" ? "Ingreso" : "Gasto"}</td><td>{money(t.amount)}</td><td title={t.notes || undefined} style={{maxWidth:240,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.notes || "—"}</td><td>{t.reversal_of ? "Reversión" : reversed ? "Revertido" : "Registrado"}</td><td>{t.operation_key && !t.reversal_of && !reversed ? <ReverseCashForm id={t.id} date={date} operationKey={crypto.randomUUID()}/> : !t.reversal_of && !reversed ? "Desde su módulo" : "—"}</td></tr>;})}
      </tbody></table></div> : <p>{page>pageCount ? "No hay movimientos en esta página." : "No hay movimientos para mostrar."}</p>}
      <div className="table-toolbar"><span>Página {page} de {pageCount}</span><div>{page>1 && <Link href={href(type,page-1)}>← Anterior</Link>}{page<pageCount && <>　<Link href={href(type,page+1)}>Siguiente →</Link></>}</div></div>
      <p className="muted">Para corregir un movimiento manual, podés revertirlo desde la fila y registrar el movimiento correcto. Los cobros y pagos vinculados se revierten desde pedidos, compras o remuneraciones.</p>
    </section>
  </main>;
}
