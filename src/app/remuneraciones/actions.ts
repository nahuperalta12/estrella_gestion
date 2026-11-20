"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
export type PayState={ok?:boolean;message?:string};
export async function pay(_:PayState,form:FormData):Promise<PayState> {
  const parsed=z.object({key:z.string().uuid(),worker:z.string().uuid(),date:z.iso.date(),amount:z.coerce.number().finite().positive().max(999999999999).refine(n=>Math.abs(n*100-Math.round(n*100))<1e-6),method:z.string().trim().min(1).max(80),notes:z.string().trim().max(500)}).safeParse({key:form.get("key"),worker:form.get("worker"),date:form.get("date"),amount:form.get("amount"),method:form.get("method"),notes:form.get("notes")});
  if(!parsed.success) return {message:"Revisá la fecha, el importe y el medio de pago."};
  const p=parsed.data,db=await createClient(); const {error}=await db.rpc("pay_collaborator",{p_key:p.key,p_worker:p.worker,p_date:p.date,p_amount:p.amount,p_method:p.method,p_notes:p.notes});
  if(error) return {message:"No se pudo registrar el pago. Verificá el saldo pendiente y tus permisos."};
  revalidatePath("/remuneraciones"); return {ok:true,message:"Pago registrado."};
}
