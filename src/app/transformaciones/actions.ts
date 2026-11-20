"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
export type State={ok?:boolean;message?:string};
const quantity=z.coerce.number().finite().positive().max(999999999999).refine(n=>Math.abs(n*1000-Math.round(n*1000))<1e-7);
export async function transform(_:State,data:FormData):Promise<State> {
  const r=z.object({key:z.string().uuid(),source:z.string().uuid(),result:z.string().uuid(),sourceQuantity:quantity,resultQuantity:quantity,reason:z.string().trim().min(1).max(500)}).safeParse({key:data.get("key"),source:data.get("source"),result:data.get("result"),sourceQuantity:data.get("sourceQuantity"),resultQuantity:data.get("resultQuantity"),reason:data.get("reason")});
  if(!r.success || r.data.source===r.data.result) return {message:"Elegí dos materiales distintos e ingresá cantidades positivas y el motivo."};
  const p=r.data,db=await createClient(); const {error}=await db.rpc("transform_material",{p_key:p.key,p_source:p.source,p_result:p.result,p_source_quantity:p.sourceQuantity,p_result_quantity:p.resultQuantity,p_reason:p.reason});
  if(error) return {message:"No se pudo registrar la transformación. Verificá el stock y que ambos materiales estén activos."};
  revalidatePath("/transformaciones"); revalidatePath("/inventario"); return {ok:true,message:"Transformación registrada."};
}
