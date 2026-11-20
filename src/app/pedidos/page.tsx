import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {OrderForm,StatusForm,PaymentForm,DeliveryForm} from "./forms";
import {PaymentReversalForm} from "@/app/reversiones/form";

export const dynamic="force-dynamic";
const currency=(amount:number)=>amount.toLocaleString("es-AR",{style:"currency",currency:"ARS"});
export default async function OrdersPage() {
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user) redirect("/ingresar");
  const {data:profile}=await db.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
  if(!profile?.active || profile.role!=="admin") redirect("/");
  const [customers,products,orders]=await Promise.all([
    db.from("customers").select("id,name,active").order("name"),
    db.from("products").select("id,name,size,color,active").order("name"),
    db.from("sales_orders").select("id,customer_id,product_id,ordered_on,due_on,quantity,unit_price,status,notes").order("created_at",{ascending:false}).limit(100),
  ]);
  if([customers,products,orders].some(x=>x.error)) return <main className="content"><Link href="/">← Inicio</Link><h1>Pedidos no disponibles</h1><p>Revisá la conexión y las migraciones.</p></main>;
  const orderIds=(orders.data ?? []).map(o=>o.id);
  const productIds=[...new Set((orders.data ?? []).map(o=>o.product_id))];
  const [payments,deliveries,stock]=await Promise.all([
    orderIds.length ? db.from("sales_order_payment_progress").select("id,paid").in("id",orderIds) : Promise.resolve({data:[],error:null}),
    orderIds.length ? db.from("order_delivery_progress").select("id,delivered").in("id",orderIds) : Promise.resolve({data:[],error:null}),
    productIds.length ? db.from("finished_stock").select("product_id,received,delivered").in("product_id",productIds) : Promise.resolve({data:[],error:null}),
  ]);
  if([payments,deliveries,stock].some(x=>x.error) || payments.data?.length!==orderIds.length || deliveries.data?.length!==orderIds.length || stock.data?.length!==productIds.length) return <main className="content"><Link href="/">← Inicio</Link><h1>Pedidos no disponibles</h1><p>No se pudieron obtener todos los saldos y existencias.</p></main>;
  const history=orderIds.length ? await db.from("customer_payments").select("id,order_id,paid_on,amount,method").in("order_id",orderIds).order("created_at",{ascending:false}).limit(100) : {data:[],error:null};
  if(history.error) return <main className="content"><Link href="/">← Inicio</Link><h1>Pedidos no disponibles</h1><p>No se pudo consultar el historial de cobros.</p></main>;
  const paymentIds=(history.data ?? []).map(p=>p.id);
  const reversals=paymentIds.length ? await db.from("payment_reversals").select("customer_payment_id,reason,reversed_on").in("customer_payment_id",paymentIds) : {data:[],error:null};
  if(reversals.error) return <main className="content"><Link href="/">← Inicio</Link><h1>Pedidos no disponibles</h1><p>No se pudo consultar el estado de los cobros.</p></main>;
  const date=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Argentina/Buenos_Aires",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const productName=(id:string)=>{const p=products.data?.find(x=>x.id===id);return p ? [p.name,p.size,p.color].filter(Boolean).join(" · ") : "Producto";};
  return <main className="content"><Link href="/">← Inicio</Link><h1>Pedidos</h1><p><Link href="/exportar/pedidos" download prefetch={false}>Descargar pedidos CSV</Link></p><p className="muted">Las entregas consumen plumas terminadas recibidas. Aún no existen reservas, devoluciones de productos ni pedidos con varios productos. Se muestran hasta 100 cobros recientes entre los pedidos visibles.</p><OrderForm customers={(customers.data ?? []).filter(x=>x.active)} products={(products.data ?? []).filter(x=>x.active).map(x=>({id:x.id,name:productName(x.id)}))} date={date} operationKey={crypto.randomUUID()}/><section className="next"><h2>Stock de los pedidos visibles</h2>{!stock.data?.length && <p>No hay pedidos visibles.</p>}{stock.data?.map(s=><article className="tile" key={s.product_id}><h3>{productName(s.product_id)}</h3><p>Recibidas: {s.received} · Entregadas: {s.delivered} · Disponibles: {Number(s.received)-Number(s.delivered)}</p></article>)}</section><section className="next"><h2>Pedidos recientes</h2>{!orders.data?.length && <p>No hay pedidos registrados.</p>}{orders.data?.map(o=>{
    const paid=Number(payments.data?.find(p=>p.id===o.id)?.paid ?? 0);
    const delivered=Number(deliveries.data?.find(d=>d.id===o.id)?.delivered ?? 0);
    const productStock=stock.data?.find(s=>s.product_id===o.product_id);
    const available=Number(productStock?.received ?? 0)-Number(productStock?.delivered ?? 0);
    const total=Number(o.unit_price)*o.quantity;
    return <article className="tile" key={o.id}><h3>{customers.data?.find(c=>c.id===o.customer_id)?.name ?? "Cliente"} · {productName(o.product_id)}</h3><p>{o.ordered_on} · {o.quantity} unidades · precio unitario {currency(Number(o.unit_price))}</p>{o.due_on && <p>Entrega estimada: {o.due_on}</p>}{o.notes && <p>{o.notes}</p>}<p>Cobrado: {currency(paid)} · Total pactado: {currency(total)}</p><p>Entregadas: {delivered} · Pendientes: {o.quantity-delivered} · Disponibles de este producto: {available}</p>{o.status!=="cancelado" && paid<total && <PaymentForm id={o.id} operationKey={crypto.randomUUID()} date={date}/>}{o.status!=="cancelado" && delivered<o.quantity && <DeliveryForm id={o.id} operationKey={crypto.randomUUID()} date={date} remaining={o.quantity-delivered} available={available}/>}{history.data?.filter(h=>h.order_id===o.id).map(h=>{const reversal=reversals.data?.find(r=>r.customer_payment_id===h.id);return <section key={h.id}><p>Cobro {h.paid_on} · {currency(Number(h.amount))} · {h.method}{reversal && " · Revertido"}</p>{reversal ? <p>Reversión: {reversal.reversed_on} · {reversal.reason}</p> : <PaymentReversalForm kind="customer" id={h.id} date={date} operationKey={crypto.randomUUID()}/>}</section>;})}<StatusForm id={o.id} status={o.status}/></article>;
  })}</section></main>;
}
