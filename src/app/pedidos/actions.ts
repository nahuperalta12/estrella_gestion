"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
export type OrderState = {message?:string;ok?:boolean};
export async function updateOrder(_:OrderState, data:FormData):Promise<OrderState> {
  const r=z.object({id:z.string().uuid(),customer:z.string().uuid(),product:z.string().uuid(),date:z.iso.date(),due:z.union([z.literal(""),z.iso.date()]),quantity:z.coerce.number().int().positive().max(2147483647),price:z.coerce.number().finite().min(0).max(999999999999).refine(n=>Math.abs(n*100-Math.round(n*100))<1e-6),notes:z.string().trim().max(2000)}).safeParse({id:data.get("id"),customer:data.get("customer"),product:data.get("product"),date:data.get("date"),due:data.get("due"),quantity:data.get("quantity"),price:data.get("price"),notes:data.get("notes")});
  if(!r.success) return {message:"Revisá las fechas, la cantidad y el precio."};
  const p=r.data,db=await createClient();
  const {error}=await db.rpc("update_sales_order",{p_id:p.id,p_customer:p.customer,p_product:p.product,p_date:p.date,p_due:p.due || null,p_quantity:p.quantity,p_price:p.price,p_notes:p.notes});
  if(error) return {message:"No se pudo modificar el pedido. Revisá que el total cubra lo cobrado y que la cantidad y el producto sean compatibles con las entregas."};
  revalidatePath("/pedidos"); return {ok:true,message:"Pedido actualizado."};
}
export async function createOrder(_:OrderState, data:FormData):Promise<OrderState> {
  const r = z.object({key:z.string().uuid(),customer:z.string().uuid(),product:z.string().uuid(),date:z.iso.date(),due:z.union([z.literal(""),z.iso.date()]),quantity:z.coerce.number().int().positive().max(2147483647),price:z.coerce.number().finite().min(0).max(999999999999).refine(n=>Math.abs(n*100-Math.round(n*100))<1e-6),notes:z.string().trim().max(2000)}).safeParse({key:data.get("key"),customer:data.get("customer"),product:data.get("product"),date:data.get("date"),due:data.get("due"),quantity:data.get("quantity"),price:data.get("price"),notes:data.get("notes")});
  if (!r.success) return {message:"Revisá las fechas, la cantidad y el precio."};
  const p=r.data, db=await createClient(); const {error}=await db.rpc("create_sales_order",{p_key:p.key,p_customer:p.customer,p_product:p.product,p_date:p.date,p_due:p.due || null,p_quantity:p.quantity,p_price:p.price,p_notes:p.notes});
  if (error) return {message:"No se pudo registrar el pedido. Revisá los datos y tus permisos."};
  revalidatePath("/pedidos"); return {ok:true,message:"Pedido registrado."};
}
export async function setOrderStatus(_:OrderState,data:FormData):Promise<OrderState> {
  const r=z.object({id:z.string().uuid(),status:z.enum(["pendiente","en_produccion","listo","cancelado"])}).safeParse({id:data.get("id"),status:data.get("status")});
  if(!r.success) return {message:"Estado inválido."};
  const db=await createClient(); const {error}=await db.rpc("set_sales_order_status",{p_id:r.data.id,p_status:r.data.status});
  if(error) return {message:"No se pudo cambiar el estado. Los pedidos entregados o con pagos o entregas no pueden cancelarse desde aquí."}; revalidatePath("/pedidos"); return {message:"Estado actualizado."};
}
export async function deliverOrder(_:OrderState,data:FormData):Promise<OrderState> {
  const r=z.object({key:z.string().uuid(),order:z.string().uuid(),date:z.iso.date(),quantity:z.coerce.number().int().positive().max(2147483647),notes:z.string().trim().max(500)}).safeParse({key:data.get("key"),order:data.get("order"),date:data.get("date"),quantity:data.get("quantity"),notes:data.get("notes")});
  if(!r.success) return {message:"Revisá la fecha y la cantidad."};
  const db=await createClient(),p=r.data; const {error}=await db.rpc("deliver_order",{p_key:p.key,p_order:p.order,p_date:p.date,p_quantity:p.quantity,p_notes:p.notes});
  if(error) return {message:"No se pudo registrar la entrega. Revisá el stock terminado y la cantidad pendiente del pedido."};
  revalidatePath("/pedidos"); return {ok:true,message:"Entrega al cliente registrada."};
}
export async function recordPayment(_:OrderState,data:FormData):Promise<OrderState> {
  const r=z.object({key:z.string().uuid(),order:z.string().uuid(),date:z.iso.date(),amount:z.coerce.number().finite().positive().max(999999999999).refine(n=>Math.abs(n*100-Math.round(n*100))<1e-6),method:z.string().trim().min(1).max(80),notes:z.string().trim().max(500)}).safeParse({key:data.get("key"),order:data.get("order"),date:data.get("date"),amount:data.get("amount"),method:data.get("method"),notes:data.get("notes")});
  if(!r.success) return {message:"Revisá el importe, la fecha y el medio de cobro."};
  const db=await createClient(),p=r.data; const {error}=await db.rpc("record_customer_payment",{p_key:p.key,p_order:p.order,p_date:p.date,p_amount:p.amount,p_method:p.method,p_notes:p.notes});
  if(error) return {message:"No se pudo registrar el cobro. Revisá el saldo y el estado del pedido."};
  revalidatePath("/pedidos"); return {ok:true,message:"Cobro registrado."};
}
