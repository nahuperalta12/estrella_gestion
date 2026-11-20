"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
export type CashState={ok?:boolean;message?:string};
export async function addCash(_:CashState,data:FormData):Promise<CashState> {
  const parsed=z.object({key:z.string().uuid(),date:z.iso.date(),direction:z.enum(["income","expense"]),amount:z.coerce.number().finite().positive().max(999999999999).refine(n=>Math.abs(n*100-Math.round(n*100))<1e-6),category:z.string().trim().min(1).max(80),notes:z.string().trim().max(500)}).safeParse({key:data.get("key"),date:data.get("date"),direction:data.get("direction"),amount:data.get("amount"),category:data.get("category"),notes:data.get("notes")});
  if(!parsed.success) return {message:"Revisá la fecha, el importe y el concepto."};
  const db=await createClient(),p=parsed.data; const {error}=await db.rpc("record_other_cash",{p_key:p.key,p_date:p.date,p_direction:p.direction,p_amount:p.amount,p_category:p.category,p_notes:p.notes});
  if(error) return {message:"No se pudo registrar el movimiento. Revisá los datos y tus permisos."};
  revalidatePath("/finanzas"); return {ok:true,message:"Movimiento registrado."};
}
export async function reverseCash(_:CashState,data:FormData):Promise<CashState> {
  const parsed=z.object({key:z.string().uuid(),original:z.string().uuid(),date:z.iso.date(),reason:z.string().trim().min(1).max(500)}).safeParse({key:data.get("key"),original:data.get("original"),date:data.get("date"),reason:data.get("reason")});
  if(!parsed.success) return {message:"Ingresá la fecha y el motivo de la reversión."};
  const db=await createClient(),p=parsed.data; const {error}=await db.rpc("reverse_other_cash",{p_key:p.key,p_original:p.original,p_date:p.date,p_reason:p.reason});
  if(error) return {message:"No se pudo revertir. Verificá que sea un movimiento manual sin reversión previa."};
  revalidatePath("/finanzas"); return {ok:true,message:"Reversión registrada."};
}
