import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {OrderForm,EditOrderForm,StatusForm,PaymentForm,DeliveryForm} from "./forms";
import {PaymentReversalForm} from "@/app/reversiones/form";
import styles from "./pedidos.module.css";

export const dynamic="force-dynamic";
const currency=(amount:number)=>amount.toLocaleString("es-AR",{style:"currency",currency:"ARS"});
const formatDate=(value:string)=>{const [year,month,day]=value.split("-"); return `${day}/${month}/${year}`;};
const statusLabel:Record<string,string>={pendiente:"Pendiente",en_produccion:"En producción",listo:"Listo",entregado:"Entregado",cancelado:"Cancelado"};

type SearchParams=Promise<{pedido?:string|string[];q?:string|string[];pagina?:string|string[]}>;
export default async function OrdersPage({searchParams}:{searchParams:SearchParams}) {
  const params=await searchParams;
  const query=typeof params.q==="string" ? params.q.trim().slice(0,120) : "";
  const selectedId=typeof params.pedido==="string" ? params.pedido : "";
  const pageValue=typeof params.pagina==="string" ? Number(params.pagina) : 1;
  const page=Number.isSafeInteger(pageValue) && pageValue>0 ? Math.min(pageValue,100000) : 1;
  const pageSize=25;
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user) redirect("/ingresar");
  const {data:profile}=await db.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
  if(!profile?.active || profile.role!=="admin") redirect("/");
  // Recorrer los catálogos evita que el límite predeterminado de Supabase
  // oculte opciones del formulario y coincidencias de búsqueda.
  const allCustomers: {id:string;name:string;phone:string|null;active:boolean}[]=[];
  const allProducts: {id:string;name:string;size:string|null;color:string|null;active:boolean}[]=[];
  let catalogError=false;
  for(let offset=0;;offset+=1000){const result=await db.from("customers").select("id,name,phone,active").order("name").order("id").range(offset,offset+999); if(result.error){catalogError=true;break;} allCustomers.push(...(result.data ?? [])); if((result.data?.length ?? 0)<1000) break;}
  for(let offset=0;;offset+=1000){const result=await db.from("products").select("id,name,size,color,active").order("name").order("id").range(offset,offset+999); if(result.error){catalogError=true;break;} allProducts.push(...(result.data ?? [])); if((result.data?.length ?? 0)<1000) break;}
  if(catalogError) return <main className="content"><Link href="/">← Inicio</Link><h1>Pedidos no disponibles</h1><p>No se pudieron obtener los catálogos.</p></main>;
  const customers={data:allCustomers},products={data:allProducts};
  const productName=(id:string)=>{const p=products.data.find(x=>x.id===id);return p ? [p.name,p.size,p.color].filter(Boolean).join(" · ") : "Producto";};
  const normalizedQuery=query.toLocaleLowerCase("es-AR");
  const customerMatches=query ? allCustomers.filter(c=>[c.name,c.phone].some(v=>v?.toLocaleLowerCase("es-AR").includes(normalizedQuery))).map(c=>c.id) : [];
  const productMatches=query ? allProducts.filter(p=>[p.name,p.size,p.color].filter(Boolean).join(" · ").toLocaleLowerCase("es-AR").includes(normalizedQuery)).map(p=>p.id) : [];
  const statusMatches=query ? Object.entries(statusLabel).filter(([,label])=>label.toLocaleLowerCase("es-AR").includes(normalizedQuery)).map(([status])=>status) : [];
  const filters=[customerMatches.length ? `customer_id.in.(${customerMatches.join(",")})` : "",productMatches.length ? `product_id.in.(${productMatches.join(",")})` : "",statusMatches.length ? `status.in.(${statusMatches.join(",")})` : ""].filter(Boolean);
  let orderQuery=db.from("sales_orders").select("id,customer_id,product_id,ordered_on,due_on,quantity,unit_price,status,notes",{count:"exact"}).order("ordered_on",{ascending:false}).order("created_at",{ascending:false}).order("id",{ascending:false}).range((page-1)*pageSize,page*pageSize-1);
  // Solo se interpolan UUID obtenidos de la base y estados definidos arriba.
  if(query && filters.length) orderQuery=orderQuery.or(filters.join(","));
  const orders=query && !filters.length ? {data:[],error:null,count:0} : await orderQuery;
  if(orders.error) return <main className="content"><Link href="/">← Inicio</Link><h1>Pedidos no disponibles</h1><p>Revisá la conexión y las migraciones.</p></main>;
  const visibleOrders=orders.data ?? [];
  const selected=visibleOrders.find(o=>o.id===selectedId);
  const orderIds=(orders.data ?? []).map(o=>o.id);
  const productIds=[...new Set((orders.data ?? []).map(o=>o.product_id))];
  const [payments,deliveries,stock]=await Promise.all([
    orderIds.length ? db.from("sales_order_payment_progress").select("id,paid").in("id",orderIds) : Promise.resolve({data:[],error:null}),
    orderIds.length ? db.from("order_delivery_progress").select("id,delivered").in("id",orderIds) : Promise.resolve({data:[],error:null}),
    productIds.length ? db.from("finished_stock").select("product_id,received,delivered").in("product_id",productIds) : Promise.resolve({data:[],error:null}),
  ]);
  if([payments,deliveries,stock].some(x=>x.error) || payments.data?.length!==orderIds.length || deliveries.data?.length!==orderIds.length || stock.data?.length!==productIds.length) return <main className="content"><Link href="/">← Inicio</Link><h1>Pedidos no disponibles</h1><p>No se pudieron obtener todos los saldos y existencias.</p></main>;
  const history=selected ? await db.from("customer_payments").select("id,order_id,paid_on,amount,method,notes").eq("order_id",selected.id).order("created_at",{ascending:false}).limit(100) : {data:[],error:null};
  if(history.error) return <main className="content"><Link href="/">← Inicio</Link><h1>Pedidos no disponibles</h1><p>No se pudo consultar el historial de cobros.</p></main>;
  const paymentIds=(history.data ?? []).map(p=>p.id);
  const reversals=paymentIds.length ? await db.from("payment_reversals").select("customer_payment_id,reason,reversed_on").in("customer_payment_id",paymentIds) : {data:[],error:null};
  if(reversals.error) return <main className="content"><Link href="/">← Inicio</Link><h1>Pedidos no disponibles</h1><p>No se pudo consultar el estado de los cobros.</p></main>;
  const date=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Argentina/Buenos_Aires",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const pageHref=(targetPage:number,id?:string)=>{const result=new URLSearchParams(); if(query) result.set("q",query); if(targetPage>1) result.set("pagina",String(targetPage)); if(id) result.set("pedido",id); return `/pedidos${result.size ? `?${result.toString()}` : ""}${id ? "#detalle-pedido" : ""}`;};
  const totalPages=Math.max(1,Math.ceil((orders.count ?? 0)/pageSize));
  return <main className={`content ${styles.page}`}>
    <Link href="/">← Inicio</Link>
    <div className={styles.heading}><div><h1>Pedidos</h1><p className="muted">Consultá los pedidos y gestioná sus cobros, entregas y estado.</p></div><Link href="/exportar/pedidos" download prefetch={false}>Descargar CSV</Link></div>
    <details className={`tile ${styles.newOrder}`}><summary>+ Nuevo pedido</summary><OrderForm customers={(customers.data ?? []).filter(x=>x.active)} products={(products.data ?? []).filter(x=>x.active).map(x=>({id:x.id,name:productName(x.id)}))} date={date} operationKey={crypto.randomUUID()}/></details>
    <section aria-labelledby="orders-title" className={styles.orders}>
      <div className={styles.toolbar}><div><h2 id="orders-title">Listado de pedidos</h2><p className="muted">Buscá por cliente, teléfono, producto o estado.</p></div><form action="/pedidos" className={styles.search}><label htmlFor="order-search">Buscar</label><input id="order-search" name="q" defaultValue={query} maxLength={120} placeholder="Cliente, teléfono o producto"/><button type="submit">Buscar</button>{query && <Link href="/pedidos">Limpiar</Link>}</form></div>
      <div className={styles.layout}>
        <div className={`table-wrap ${styles.tableWrap}`} tabIndex={0} aria-label="Listado de pedidos, desplazable horizontalmente">
          <table className={`data-table ${styles.table}`}><thead><tr><th scope="col">Fecha</th><th scope="col">Cliente</th><th scope="col">Teléfono</th><th scope="col">Producto</th><th scope="col">Cantidad</th><th scope="col">Precio unit.</th><th scope="col">Total</th><th scope="col">Cobrado</th><th scope="col">Pendiente</th><th scope="col">Pago</th><th scope="col">Entrega</th><th scope="col">Estado</th><th scope="col"><span className={styles.srOnly}>Acciones</span></th></tr></thead><tbody>
          {visibleOrders.map(o=>{
            const customer=customers.data?.find(c=>c.id===o.customer_id);
            const paid=Number(payments.data?.find(p=>p.id===o.id)?.paid ?? 0);
            const delivered=Number(deliveries.data?.find(d=>d.id===o.id)?.delivered ?? 0);
            const total=Number(o.unit_price)*o.quantity;
            return <tr key={o.id} className={selected?.id===o.id ? styles.selected : undefined}><td>{formatDate(o.ordered_on)}</td><th scope="row">{customer?.name ?? "Cliente"}</th><td>{customer?.phone || "—"}</td><td>{productName(o.product_id)}</td><td className={styles.number}>{o.quantity}</td><td className={styles.number}>{currency(Number(o.unit_price))}</td><td className={styles.number}>{currency(total)}</td><td className={styles.number}>{currency(paid)}</td><td className={styles.number}>{currency(Math.max(0,total-paid))}</td><td>{paid>=total ? "Completo" : paid>0 ? "Parcial" : "Pendiente"}</td><td>{delivered>=o.quantity ? "Completa" : delivered>0 ? `Parcial (${delivered}/${o.quantity})` : "Pendiente"}</td><td>{statusLabel[o.status] ?? o.status}</td><td><Link href={pageHref(page,o.id)} aria-label={`Gestionar pedido de ${customer?.name ?? "cliente"}`} aria-current={selected?.id===o.id ? "true" : undefined}>Gestionar</Link></td></tr>;
          })}
          </tbody></table>{!visibleOrders.length && <p className={styles.empty}>{page>1 ? "No hay pedidos en esta página." : query ? "No hay pedidos que coincidan con la búsqueda." : "No hay pedidos registrados."}</p>}<nav className={styles.pagination} aria-label="Páginas de pedidos">{page>1 && <Link href={pageHref(page-1)}>← Anterior</Link>}<span>Página {page} de {totalPages} · {orders.count ?? 0} pedidos</span>{page<totalPages && <Link href={pageHref(page+1)}>Siguiente →</Link>}</nav>
        </div>
        {selected && (()=>{
          const o=selected;
          const customer=customers.data?.find(c=>c.id===o.customer_id);
          const paid=Number(payments.data?.find(p=>p.id===o.id)?.paid ?? 0);
          const delivered=Number(deliveries.data?.find(d=>d.id===o.id)?.delivered ?? 0);
          const productStock=stock.data?.find(s=>s.product_id===o.product_id);
          const available=Number(productStock?.received ?? 0)-Number(productStock?.delivered ?? 0);
          const total=Number(o.unit_price)*o.quantity;
          const backHref=pageHref(page);
          return <aside id="detalle-pedido" className={`tile ${styles.detail}`} aria-labelledby="detail-title"><div className={styles.detailHeading}><h2 id="detail-title">Gestionar pedido</h2><Link href={backHref} aria-label="Cerrar detalle del pedido">Cerrar</Link></div><h3>{customer?.name ?? "Cliente"}</h3><p>{productName(o.product_id)} · {o.quantity} unidades</p><p>Fecha: {formatDate(o.ordered_on)}{o.due_on && <> · Entrega estimada: {formatDate(o.due_on)}</>}</p>{o.notes && <p>Observaciones: {o.notes}</p>}<p>Cobrado: {currency(paid)} de {currency(total)} · Pendiente: {currency(Math.max(0,total-paid))}</p><p>Entregadas: {delivered} de {o.quantity} · Disponibles en stock: {available}</p>
            <details className={styles.action}><summary>Modificar datos</summary><EditOrderForm order={{...o,unit_price:Number(o.unit_price)}} customers={(customers.data ?? []).filter(x=>x.active || x.id===o.customer_id).map(x=>({id:x.id,name:x.name+(x.active ? "" : " (inactivo)")}))} products={(products.data ?? []).filter(x=>x.active || x.id===o.product_id).map(x=>({id:x.id,name:productName(x.id)+(x.active ? "" : " (inactivo)")}))}/></details>
            <details className={styles.action}><summary>Cambiar estado</summary><StatusForm id={o.id} status={o.status}/></details>
            {o.status!=="cancelado" && paid<total && <details className={styles.action}><summary>Registrar cobro</summary><PaymentForm id={o.id} operationKey={crypto.randomUUID()} date={date}/></details>}
            {o.status!=="cancelado" && delivered<o.quantity && <details className={styles.action}><summary>Registrar entrega</summary><p className="muted">La entrega descuenta del stock de producto terminado.</p><DeliveryForm id={o.id} operationKey={crypto.randomUUID()} date={date} remaining={o.quantity-delivered} available={available}/></details>}
            <details className={styles.action}><summary>Historial de cobros</summary><p className="muted">Se muestran hasta 100 cobros recientes de este pedido.</p>{!history.data?.some(h=>h.order_id===o.id) && <p>No hay cobros recientes para este pedido.</p>}{history.data?.filter(h=>h.order_id===o.id).map(h=>{const reversal=reversals.data?.find(r=>r.customer_payment_id===h.id);return <section className={styles.payment} key={h.id}><p>Cobro {h.paid_on ? formatDate(h.paid_on) : "con fecha desconocida"} · {currency(Number(h.amount))} · {h.method}{reversal && " · Revertido"}</p>{h.notes && <p>{h.notes}</p>}{reversal ? <p>Reversión: {formatDate(reversal.reversed_on)} · {reversal.reason}</p> : <PaymentReversalForm kind="customer" id={h.id} date={date} operationKey={crypto.randomUUID()}/>}</section>;})}</details>
          </aside>;
        })()}
      </div>
    </section>
    <details className={`tile ${styles.stock}`}><summary>Stock de los productos de los pedidos</summary>{!stock.data?.length && <p>No hay pedidos visibles.</p>}{stock.data?.map(s=><p key={s.product_id}><strong>{productName(s.product_id)}:</strong> {Number(s.received)-Number(s.delivered)} disponibles ({s.received} recibidas · {s.delivered} entregadas)</p>)}</details>
    <p className="muted">Por ahora cada pedido admite un producto. Las reservas y devoluciones de productos aún no están disponibles.</p>
  </main>;
}
