"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
export type ReversalState={ok?:boolean;message?:string};
export async function reversePayment(_:ReversalState,form:FormData):Promise<ReversalState> {
  const p=z.object({key:z.string().uuid(),kind:z.enum(["collaborator","customer","supplier"]),payment:z.string().uuid(),date:z.iso.date(),reason:z.string().trim().min(1).max(500)}).safeParse({key:form.get("key"),kind:form.get("kind"),payment:form.get("payment"),date:form.get("date"),reason:form.get("reason")});
  if(!p.success) return {message:"Revisá la fecha y el motivo."};
  const db=await createClient(),d=p.data; const {error}=await db.rpc("reverse_linked_payment",{p_key:d.key,p_kind:d.kind,p_payment:d.payment,p_date:d.date,p_reason:d.reason});
  if(error) return {message:"No se pudo registrar la reversión. Verificá que el pago exista y no haya sido revertido."};
  for(const path of ["/finanzas","/remuneraciones","/compras","/pedidos","/"]) revalidatePath(path);
  return {ok:true,message:"Reversión registrada."};
}
