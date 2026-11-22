import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {CreateCollaboratorForm,EditCollaboratorForm} from "./forms";
export const dynamic="force-dynamic";
export default async function CollaboratorsPage() {
  const db=await createClient(); const {data:{user}}=await db.auth.getUser(); if(!user) redirect("/ingresar");
  const {data:profile}=await db.from("profiles").select("role,active").eq("id",user.id).maybeSingle(); if(!profile?.active || profile.role!=="admin") redirect("/");
  const {data,error}=await db.from("profiles").select("id,display_name,active").eq("role","collaborator").order("display_name");
  if(error) return <main className="content"><Link href="/">← Inicio</Link><h1>Colaboradores no disponibles</h1><p>Revisá la conexión y las migraciones.</p></main>;
  return <main className="content"><Link href="/cargas">← Cargas y ABM</Link><h1>Colaboradores</h1><p className="muted">Podés crear cuentas, cambiar nombres y activar o dar de baja el acceso. La baja conserva el historial de producción y pagos.</p><CreateCollaboratorForm configured={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}/><section className="next"><h2>Colaboradores registrados</h2>{!data?.length && <p>No hay colaboradores registrados.</p>}{data?.map(item=><details className="tile" key={item.id}><summary>{item.display_name} {item.active ? "· Activo":"· Inactivo"} — Editar</summary><EditCollaboratorForm item={item}/></details>)}</section></main>;
}
