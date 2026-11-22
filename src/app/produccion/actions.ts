"use server";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
export type State={message?:string;ok?:boolean};
const amount=z.coerce.number().finite().positive().max(999999999999).refine(n=>Math.abs(n*1000-Math.round(n*1000))<1e-7);
export async function createRecipe(_:State,form:FormData):Promise<State> {
  const ids=form.getAll("material"), quantities=form.getAll("quantity");
  const p=z.object({product:z.string().uuid(),items:z.array(z.object({material:z.string().uuid(),quantity:amount})).min(1).max(50)}).safeParse({product:form.get("product"),items:ids.map((material,i)=>({material,quantity:quantities[i]}))});
  if(!p.success || new Set(ids).size!==ids.length) return {message:"Revisá los materiales, que no se repitan, y las cantidades."};
  const db=await createClient(); const {error}=await db.rpc("create_recipe",{p_product:p.data.product,p_items:p.data.items});
  if(error) return {message:"No se pudo guardar la receta. Revisá los materiales, el producto y tus permisos."};
  revalidatePath("/produccion"); return {ok:true,message:"Receta guardada como nueva versión."};
}
export async function createAssignment(_:State,form:FormData):Promise<State> {
  const p=z.object({key:z.string().uuid(),worker:z.string().uuid(),product:z.string().uuid(),quantity:z.coerce.number().int().positive().max(2147483647),rate:z.coerce.number().finite().min(0).max(999999999999).refine(n=>Math.abs(n*100-Math.round(n*100))<1e-6),due:z.union([z.literal(""),z.iso.date()]),notes:z.string().trim().max(500)}).safeParse({key:form.get("key"),worker:form.get("worker"),product:form.get("product"),quantity:form.get("quantity"),rate:form.get("rate"),due:form.get("due"),notes:form.get("notes")});
  if(!p.success) return {message:"Revisá la asignación, la cantidad y la tarifa."};
  const db=await createClient(), d=p.data; const {error}=await db.rpc("create_production_assignment",{p_key:d.key,p_worker:d.worker,p_product:d.product,p_quantity:d.quantity,p_rate:d.rate,p_due:d.due || null,p_notes:d.notes});
  if(error) return {message:"No se pudo asignar. Verificá que el producto tenga receta y que el colaborador esté activo."};
  revalidatePath("/produccion"); return {ok:true,message:"Asignación creada."};
}
export async function recordProduction(_:State,form:FormData):Promise<State> {
  const p=z.object({key:z.string().uuid(),assignment:z.string().uuid(),date:z.iso.date(),quantity:z.coerce.number().int().positive().max(2147483647),notes:z.string().trim().max(500)}).safeParse({key:form.get("key"),assignment:form.get("assignment"),date:form.get("date"),quantity:form.get("quantity"),notes:form.get("notes")});
  if(!p.success) return {message:"Revisá la fecha y la cantidad."};
  const db=await createClient(), d=p.data; const {error}=await db.rpc("record_production",{p_key:d.key,p_assignment:d.assignment,p_date:d.date,p_quantity:d.quantity,p_notes:d.notes});
  if(error) return {message:"No se pudo registrar. Verificá la cantidad pendiente y los materiales disponibles en tu custodia."};
  revalidatePath("/produccion"); revalidatePath("/entregas"); return {ok:true,message:"Producción registrada."};
}
export async function recordOwnerProduction(_:State,form:FormData):Promise<State> {
  const p=z.object({key:z.string().uuid(),product:z.string().uuid(),date:z.iso.date(),quantity:z.coerce.number().int().positive().max(2147483647),notes:z.string().trim().max(500)}).safeParse({key:form.get("key"),product:form.get("product"),date:form.get("date"),quantity:form.get("quantity"),notes:form.get("notes")});
  if(!p.success) return {message:"Revisá el producto, la fecha y la cantidad."};
  const db=await createClient(),d=p.data;
  const {error}=await db.rpc("record_owner_production",{p_key:d.key,p_product:d.product,p_date:d.date,p_quantity:d.quantity,p_notes:d.notes});
  if(error) return {message:"No se pudo registrar. Verificá que el producto tenga receta y que haya materiales activos suficientes en el depósito."};
  revalidatePath("/produccion"); revalidatePath("/inventario"); revalidatePath("/");
  return {ok:true,message:"Tu producción quedó registrada, sin generar remuneración."};
}
export async function receiveFinished(_:State,form:FormData):Promise<State> {
  const p=z.object({key:z.string().uuid(),assignment:z.string().uuid(),date:z.iso.date(),quantity:z.coerce.number().int().positive().max(2147483647),notes:z.string().trim().max(500)}).safeParse({key:form.get("key"),assignment:form.get("assignment"),date:form.get("date"),quantity:form.get("quantity"),notes:form.get("notes")});
  if(!p.success) return {message:"Revisá la fecha y la cantidad."};
  const db=await createClient(),d=p.data; const {error}=await db.rpc("receive_finished_production",{p_key:d.key,p_assignment:d.assignment,p_date:d.date,p_quantity:d.quantity,p_notes:d.notes});
  if(error) return {message:"No se pudo registrar la entrega. Verificá las plumas fabricadas pendientes de recibir."};
  revalidatePath("/produccion"); return {ok:true,message:"Recepción registrada."};
}
