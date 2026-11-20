"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
export type PurchaseState = { message?: string; ok?: boolean };
export async function createPurchase(_: PurchaseState, data: FormData): Promise<PurchaseState> {
  const parsed = z.object({ key: z.string().uuid(), supplier: z.union([z.literal(""),z.string().uuid()]), material: z.string().uuid(), date: z.iso.date(), quantity: z.coerce.number().finite().positive().max(999999999999).refine(n => Math.abs(n*1000-Math.round(n*1000)) < 1e-7), total: z.coerce.number().finite().min(0).max(999999999999).refine(n => Math.abs(n*100-Math.round(n*100)) < 1e-6), notes: z.string().trim().max(2000) }).safeParse({ key: data.get("key"), supplier: data.get("supplier"), material: data.get("material"), date: data.get("date"), quantity: data.get("quantity"), total: data.get("total"), notes: data.get("notes") });
  if (!parsed.success) return { message: "Revisá los datos, la fecha y la precisión de cantidades e importes." };
  const db = await createClient(); const p = parsed.data;
  const { error } = await db.rpc("create_purchase", { p_key:p.key, p_supplier:p.supplier || null, p_material:p.material, p_date:p.date, p_quantity:p.quantity, p_total:p.total, p_notes:p.notes });
  if (error) return { message: "No se pudo registrar la compra. Revisá los datos, el estado del material y tus permisos." };
  revalidatePath("/compras"); return { ok:true, message:"Compra registrada. La recepción se confirma por separado." };
}
export async function receivePurchase(_: PurchaseState, data: FormData): Promise<PurchaseState> {
  const id = z.string().uuid().safeParse(data.get("id"));
  if (!id.success) return { message:"Compra inválida." };
  const db = await createClient(); const { error } = await db.rpc("receive_purchase", { p_id:id.data });
  if (error) return { message:"No se pudo confirmar la recepción. Verificá que el material esté activo y la conexión funcione." };
  revalidatePath("/compras"); revalidatePath("/inventario"); return { ok:true, message:"Recepción confirmada." };
}
export async function paySupplier(_: PurchaseState,data:FormData):Promise<PurchaseState> {
  const parsed=z.object({key:z.string().uuid(),purchase:z.string().uuid(),date:z.iso.date(),amount:z.coerce.number().finite().positive().max(999999999999).refine(n=>Math.abs(n*100-Math.round(n*100))<1e-6),method:z.string().trim().min(1).max(80),notes:z.string().trim().max(500)}).safeParse({key:data.get("key"),purchase:data.get("purchase"),date:data.get("date"),amount:data.get("amount"),method:data.get("method"),notes:data.get("notes")});
  if(!parsed.success) return {message:"Revisá la fecha, el importe y el medio de pago."};
  const db=await createClient(),p=parsed.data; const {error}=await db.rpc("pay_supplier",{p_key:p.key,p_purchase:p.purchase,p_date:p.date,p_amount:p.amount,p_method:p.method,p_notes:p.notes});
  if(error) return {message:"No se pudo registrar el pago. Revisá el saldo pendiente y tus permisos."};
  revalidatePath("/compras"); revalidatePath("/finanzas"); return {ok:true,message:"Pago registrado."};
}
