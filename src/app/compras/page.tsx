import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {PurchaseForm,ReceiptForm,SupplierPaymentForm} from "./forms";
import {PaymentReversalForm} from "@/app/reversiones/form";
export const dynamic="force-dynamic";
const money=(value:number)=>Number(value).toLocaleString("es-AR",{style:"currency",currency:"ARS"});
export default async function PurchasesPage() {
  const db=await createClient(); const {data:{user}}=await db.auth.getUser(); if(!user) redirect("/ingresar");
  const {data:profile}=await db.from("profiles").select("role,active").eq("id",user.id).maybeSingle(); if(!profile?.active || profile.role!=="admin") redirect("/");
  const [materials,suppliers,purchases]=await Promise.all([db.from("materials").select("id,name,unit,active").order("name"),db.from("suppliers").select("id,name,active").order("name"),db.from("purchases").select("id,supplier_id,material_id,purchased_on,quantity,total_cost,notes,received_at").order("created_at",{ascending:false}).limit(100)]);
  if(materials.error || suppliers.error || purchases.error) return <main className="content"><Link href="/">← Inicio</Link><h1>Compras no disponibles</h1><p>Revisá la conexión y las migraciones de la base de datos.</p></main>;
  const purchaseIds=(purchases.data ?? []).map(p=>p.id);
  const payments=purchaseIds.length ? await db.from("purchase_payment_progress").select("id,paid").in("id",purchaseIds) : {data:[],error:null};
  if(payments.error || payments.data?.length!==purchaseIds.length) return <main className="content"><Link href="/">← Inicio</Link><h1>Compras no disponibles</h1><p>No se pudieron obtener todos los saldos.</p></main>;
  const history=purchaseIds.length ? await db.from("supplier_payments").select("id,purchase_id,paid_on,amount,method").in("purchase_id",purchaseIds).order("created_at",{ascending:false}).limit(100) : {data:[],error:null};
  if(history.error) return <main className="content"><Link href="/">← Inicio</Link><h1>Compras no disponibles</h1><p>No se pudo consultar el historial de pagos.</p></main>;
  const paymentIds=(history.data ?? []).map(p=>p.id);
  const reversals=paymentIds.length ? await db.from("payment_reversals").select("supplier_payment_id,reason,reversed_on").in("supplier_payment_id",paymentIds) : {data:[],error:null};
  if(reversals.error) return <main className="content"><Link href="/">← Inicio</Link><h1>Compras no disponibles</h1><p>No se pudo consultar el estado de los pagos.</p></main>;
  const date=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Argentina/Buenos_Aires",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  return <main className="content"><Link href="/">← Inicio</Link><h1>Compras y recepción</h1><p className="muted">La compra, la recepción y el pago se registran por separado. Todavía no hay lotes ni conversiones automáticas. Se muestran hasta 100 pagos recientes entre las compras visibles.</p><PurchaseForm materials={(materials.data ?? []).filter(m=>m.active)} suppliers={(suppliers.data ?? []).filter(s=>s.active)} date={date} operationKey={crypto.randomUUID()}/><section className="next"><h2>Compras recientes</h2>{!purchases.data?.length && <p>No hay compras registradas.</p>}{purchases.data?.map(p=>{const paid=Number(payments.data?.find(x=>x.id===p.id)?.paid ?? 0); return <article className="tile" key={p.id}><h3>{materials.data?.find(m=>m.id===p.material_id)?.name ?? "Material"}</h3><p>{p.purchased_on} · {p.quantity} {materials.data?.find(m=>m.id===p.material_id)?.unit} · Total {money(p.total_cost)}</p><p>{suppliers.data?.find(s=>s.id===p.supplier_id)?.name ?? "Sin proveedor"} · {p.received_at ? "Recibida" : "Pendiente de recepción"}</p><p>Pagado: {money(paid)} · Pendiente: {money(Number(p.total_cost)-paid)}</p>{p.notes && <p>{p.notes}</p>}{!p.received_at && <ReceiptForm id={p.id}/>}{paid<Number(p.total_cost) && <SupplierPaymentForm id={p.id} date={date} operationKey={crypto.randomUUID()}/>}{history.data?.filter(h=>h.purchase_id===p.id).map(h=>{const reversal=reversals.data?.find(r=>r.supplier_payment_id===h.id);return <section key={h.id}><p>Pago {h.paid_on} · {money(h.amount)} · {h.method}{reversal && " · Revertido"}</p>{reversal ? <p>Reversión: {reversal.reversed_on} · {reversal.reason}</p> : <PaymentReversalForm kind="supplier" id={h.id} date={date} operationKey={crypto.randomUUID()}/>}</section>;})}</article>;})}</section></main>;
}
