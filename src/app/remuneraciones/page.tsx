import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {PaymentForm} from "./form";
import {PaymentReversalForm} from "@/app/reversiones/form";
export const dynamic="force-dynamic";
const money=(value:number)=>Number(value).toLocaleString("es-AR",{style:"currency",currency:"ARS"});
export default async function PaymentsPage() {
  const db=await createClient(); const {data:{user}}=await db.auth.getUser(); if(!user) redirect("/ingresar");
  const {data:profile}=await db.from("profiles").select("role,active").eq("id",user.id).maybeSingle(); if(!profile?.active) redirect("/");
  const admin=profile.role==="admin";
  const [balances,payments,profiles]=await Promise.all([db.from("collaborator_money").select("collaborator_id,earned,paid"),db.from("collaborator_payments").select("id,collaborator_id,paid_on,amount,method,notes").order("created_at",{ascending:false}).limit(100),admin ? db.from("profiles").select("id,display_name,role,active").order("display_name") : Promise.resolve({data:[],error:null})]);
  if(balances.error || payments.error || profiles.error) return <main className="content"><Link href="/">← Inicio</Link><h1>Remuneraciones no disponibles</h1><p>Revisá la conexión y las migraciones.</p></main>;
  const paymentIds=(payments.data ?? []).map(p=>p.id);
  const reversals=paymentIds.length ? await db.from("payment_reversals").select("collaborator_payment_id,reason,reversed_on").in("collaborator_payment_id",paymentIds) : {data:[],error:null};
  if(reversals.error) return <main className="content"><Link href="/">← Inicio</Link><h1>Remuneraciones no disponibles</h1><p>No se pudo consultar el estado de los pagos.</p></main>;
  const date=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Argentina/Buenos_Aires",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const name=(id:string)=>profiles.data?.find(p=>p.id===id)?.display_name ?? "Colaborador";
  return <main className="content"><Link href="/">← Inicio</Link><h1>{admin ? "Remuneraciones y pagos":"Mi dinero"}</h1><p><Link href="/exportar/pagos" download prefetch={false}>Descargar pagos CSV</Link></p><p className="muted">El devengamiento proviene de la producción registrada. Todavía no se admiten bonificaciones ni anticipos.</p>{admin && <PaymentForm operationKey={crypto.randomUUID()} date={date} workers={(profiles.data ?? []).filter(p=>p.role==="collaborator").map(p=>({id:p.id,name:p.display_name}))}/>}<section className="next"><h2>Saldos</h2>{!balances.data?.length && <p>No hay saldos disponibles.</p>}{balances.data?.map(b=><article className="tile" key={b.collaborator_id}>{admin && <h3>{name(b.collaborator_id)}</h3>}<p>Devengado: {money(b.earned)} · Pagado: {money(b.paid)} · Pendiente: {money(Number(b.earned)-Number(b.paid))}</p></article>)}</section><section className="next"><h2>Últimos pagos</h2>{!payments.data?.length && <p>No hay pagos registrados.</p>}{payments.data?.map(p=>{const reversal=reversals.data?.find(r=>r.collaborator_payment_id===p.id);return <article className="tile" key={p.id}><p>{admin && `${name(p.collaborator_id)} · `}{p.paid_on} · {money(p.amount)} · {p.method}{reversal && " · Revertido"}</p>{p.notes && <p>{p.notes}</p>}{reversal && <p>Reversión: {reversal.reversed_on} · {reversal.reason}</p>}{admin && !reversal && <PaymentReversalForm kind="collaborator" id={p.id} date={date} operationKey={crypto.randomUUID()}/>}</article>;})}</section></main>;
}
