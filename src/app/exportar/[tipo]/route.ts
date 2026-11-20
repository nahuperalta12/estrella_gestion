import {createClient} from "@/lib/supabase/server";
import {toCsv} from "@/lib/csv";

export const dynamic="force-dynamic";
type Row=Record<string,unknown>;
type QueryResult={data:unknown[]|null;error:unknown};
async function readAll(fetchPage:(from:number,to:number)=>PromiseLike<QueryResult>):Promise<Row[]> {
  const result:Row[]=[];
  for(let from=0;;from+=500) {
    const {data,error}=await fetchPage(from,from+499);
    if(error || !data) throw new Error("No se pudieron consultar los registros.");
    result.push(...data as Row[]);
    if(data.length<500) return result;
  }
}
export async function GET(_:Request,{params}:{params:Promise<{tipo:string}>}) {
  const {tipo}=await params;
  if(!["inventario","produccion","pagos","pedidos"].includes(tipo)) return new Response("Exportación no encontrada.",{status:404});
  const db=await createClient(); const {data:{user}}=await db.auth.getUser();
  if(!user) return new Response("Iniciá sesión para exportar.",{status:401});
  const {data:profile}=await db.from("profiles").select("active,role").eq("id",user.id).maybeSingle();
  if(!profile?.active || (profile.role!=="admin" && ["inventario","pedidos"].includes(tipo))) return new Response("No tenés permiso para esta exportación.",{status:403});
  try {
    let headers:string[]=[]; let rows:unknown[][]=[];
    if(tipo==="inventario") {
      const data=await readAll((from,to)=>db.from("materials").select("id,name,unit,minimum_stock,active,warehouse_balances(quantity)").order("id").range(from,to));
      headers=["Material","Unidad","Stock depósito","Stock mínimo","Activo"];
      rows=data.map(m=>{const raw=m.warehouse_balances;const balance=Array.isArray(raw) ? raw[0] : raw; return [m.name,m.unit,(balance as Row|null)?.quantity ?? "",m.minimum_stock,m.active ? "Sí":"No"];});
    } else if(tipo==="produccion") {
      const data=await readAll((from,to)=>db.from("production_records").select("id,produced_on,collaborator_id,assignment_id,quantity,unit_rate,earned,notes").order("id").range(from,to));
      headers=["Fecha","Colaboradora ID","Asignación ID","Cantidad","Tarifa ARS","Devengado ARS","Observaciones"];
      rows=data.map(r=>[r.produced_on,r.collaborator_id,r.assignment_id,r.quantity,r.unit_rate,r.earned,r.notes]);
    } else if(tipo==="pagos") {
      const data=await readAll((from,to)=>db.from("collaborator_payments").select("id,collaborator_id,paid_on,amount,method,notes").order("id").range(from,to));
      const reversals:Row[]=[];
      for(let i=0;i<data.length;i+=500) {
        const ids=data.slice(i,i+500).map(r=>String(r.id));
        const {data:batch,error}=await db.from("payment_reversals").select("collaborator_payment_id,reversed_on,reason").in("collaborator_payment_id",ids);
        if(error || !batch) throw new Error("No se pudo consultar el estado de los pagos.");
        reversals.push(...batch);
      }
      headers=["Fecha","Colaboradora ID","Importe ARS","Medio","Observaciones","Revertido","Fecha reversión","Motivo reversión"];
      const byPayment=new Map(reversals.map(r=>[r.collaborator_payment_id,r]));
      rows=data.map(r=>{const rev=byPayment.get(r.id);return [r.paid_on,r.collaborator_id,r.amount,r.method,r.notes,rev ? "Sí":"No",rev?.reversed_on,rev?.reason];});
    } else {
      const data=await readAll((from,to)=>db.from("sales_orders").select("id,ordered_on,due_on,customer_id,product_id,quantity,unit_price,status,notes").order("id").range(from,to));
      const paymentProgress:Row[]=[],deliveryProgress:Row[]=[];
      for(let i=0;i<data.length;i+=500) {
        const ids=data.slice(i,i+500).map(r=>String(r.id));
        const [payments,deliveries]=await Promise.all([db.from("sales_order_payment_progress").select("id,paid").in("id",ids),db.from("order_delivery_progress").select("id,delivered").in("id",ids)]);
        if(payments.error || deliveries.error || !payments.data || !deliveries.data || payments.data.length!==ids.length || deliveries.data.length!==ids.length) throw new Error("No se pudieron consultar los saldos de pedidos.");
        paymentProgress.push(...payments.data); deliveryProgress.push(...deliveries.data);
      }
      const paid=new Map(paymentProgress.map(r=>[r.id,r.paid])),delivered=new Map(deliveryProgress.map(r=>[r.id,r.delivered]));
      headers=["Pedido ID","Fecha","Entrega estimada","Cliente ID","Producto ID","Cantidad","Precio unitario ARS","Cobrado ARS","Entregado","Estado","Observaciones"];
      rows=data.map(r=>[r.id,r.ordered_on,r.due_on,r.customer_id,r.product_id,r.quantity,r.unit_price,paid.get(r.id),delivered.get(r.id),r.status,r.notes]);
    }
    return new Response(toCsv(headers,rows),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="estrella-${tipo}.csv"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  } catch {
    return new Response("No se pudo generar la exportación. Revisá la conexión y las migraciones.",{status:500,headers:{"Cache-Control":"no-store"}});
  }
}
