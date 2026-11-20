"use server";
import {createClient as createAdminClient} from "@supabase/supabase-js";
import {revalidatePath} from "next/cache";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";

export type CollaboratorState={ok?:boolean;message?:string};

async function authenticatedAdmin() {
  const db=await createClient();
  const {data:{user},error}=await db.auth.getUser();
  if(error || !user) return null;
  const {data:profile,error:profileError}=await db.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
  return !profileError && profile?.role==="admin" && profile.active ? db : null;
}
export async function createCollaborator(_:CollaboratorState,form:FormData):Promise<CollaboratorState> {
  const parsed=z.object({name:z.string().trim().min(1).max(100),email:z.string().trim().email().max(254),password:z.string().min(12).max(128)}).safeParse({name:form.get("name"),email:form.get("email"),password:form.get("password")});
  if(!parsed.success) return {message:"Revisá el nombre, el correo y la contraseña (mínimo 12 caracteres)."};
  const db=await authenticatedAdmin();
  if(!db) return {message:"Tu cuenta no tiene permiso para crear colaboradoras."};
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  if(!key || !url) return {message:"El alta de cuentas no está configurada en el servidor. Consultá las instrucciones de administración."};
  const privileged=createAdminClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  let userId:string;
  try {
    const {data,error}=await privileged.auth.admin.createUser({email:parsed.data.email,password:parsed.data.password,email_confirm:true});
    if(error || !data.user) return {message:"No se pudo confirmar el alta. Revisá si el correo ya figura en Supabase antes de volver a intentar."};
    userId=data.user.id;
  } catch {
    return {message:"Se interrumpió la comunicación durante el alta. Revisá si el correo ya figura en Supabase antes de volver a intentar."};
  }
  let registered=false;
  try { const profile=await db.rpc("register_collaborator",{p_user:userId,p_name:parsed.data.name}); registered=!profile.error; } catch { /* Verify the outcome before cleanup. */ }
  if(!registered) {
    // An RPC response can fail after commit; inspect before compensating.
    try {
      const lookup=await privileged.from("profiles").select("id,role").eq("id",userId).maybeSingle();
      if(!lookup.error && lookup.data?.role==="collaborator") { revalidatePath("/colaboradoras"); return {ok:true,message:"Colaboradora creada. Entregá las credenciales por un canal seguro."}; }
      if(!lookup.error && !lookup.data) {
        const removed=await privileged.auth.admin.deleteUser(userId);
        if(!removed.error) return {message:"No se pudo crear el perfil y la cuenta nueva se retiró. Revisá las migraciones y volvé a intentar."};
      }
    } catch { /* The account must be inspected if cleanup cannot be verified. */ }
    return {message:"La cuenta pudo crearse pero no se pudo confirmar el perfil. Revisá ese correo en el panel de Supabase antes de volver a intentar."};
  }
  revalidatePath("/colaboradoras"); return {ok:true,message:"Colaboradora creada. Entregá las credenciales por un canal seguro."};
}
export async function updateCollaborator(_:CollaboratorState,form:FormData):Promise<CollaboratorState> {
  const parsed=z.object({id:z.string().uuid(),name:z.string().trim().min(1).max(100),active:z.boolean()}).safeParse({id:form.get("id"),name:form.get("name"),active:form.get("active")==="on"});
  if(!parsed.success) return {message:"Revisá el nombre."};
  const db=await authenticatedAdmin(); if(!db) return {message:"Tu cuenta no tiene permiso para modificar colaboradoras."};
  const {error}=await db.rpc("update_collaborator",{p_user:parsed.data.id,p_name:parsed.data.name,p_active:parsed.data.active});
  if(error) return {message:"No se pudo guardar. Revisá la conexión y los permisos."};
  revalidatePath("/colaboradoras"); revalidatePath("/"); return {ok:true,message:"Colaboradora actualizada."};
}
