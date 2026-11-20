"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
export type TransferState = { message?: string; ok?: boolean };
export async function dispatch(_: TransferState, form: FormData): Promise<TransferState> {
  const parsed = z.object({ key:z.string().uuid(), collaborator:z.string().uuid(), material:z.string().uuid(), quantity:z.coerce.number().finite().positive().max(999999999999).refine(n=>Math.abs(n*1000-Math.round(n*1000))<1e-7), notes:z.string().trim().max(500) }).safeParse({key:form.get("key"),collaborator:form.get("collaborator"),material:form.get("material"),quantity:form.get("quantity"),notes:form.get("notes")});
  if(!parsed.success) return {message:"Revisá la colaboradora, el material y la cantidad."};
  const db=await createClient(); const p=parsed.data;
  const {error}=await db.rpc("dispatch_stock",{p_key:p.key,p_collaborator:p.collaborator,p_material:p.material,p_quantity:p.quantity,p_notes:p.notes});
  if(error) return {message:"No se pudo despachar. Revisá el stock y que la colaboradora y el material estén activos."};
  revalidatePath("/entregas"); revalidatePath("/inventario"); return {ok:true,message:"Entrega despachada; queda en tránsito hasta su confirmación."};
}
export async function confirmReceipt(_: TransferState, form: FormData): Promise<TransferState> {
  const id=z.string().uuid().safeParse(form.get("id")); if(!id.success) return {message:"Entrega inválida."};
  const db=await createClient(); const {error}=await db.rpc("confirm_stock_receipt",{p_id:id.data});
  if(error) return {message:"No se pudo confirmar. Revisá la conexión y que la entrega sea tuya."};
  revalidatePath("/entregas"); return {ok:true,message:"Recepción confirmada."};
}
