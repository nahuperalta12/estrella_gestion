import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {TransformationForm} from "./form";
export const dynamic="force-dynamic";
export default async function TransformationsPage() {
  const db=await createClient(); const {data:{user}}=await db.auth.getUser(); if(!user) redirect("/ingresar");
  const {data:profile}=await db.from("profiles").select("role,active").eq("id",user.id).maybeSingle(); if(!profile?.active || profile.role!=="admin") redirect("/");
  const [materials,transformations]=await Promise.all([db.from("materials").select("id,name,unit,active").order("name"),db.from("material_transformations").select("id,source_material_id,result_material_id,source_quantity,result_quantity,reason,created_at").order("created_at",{ascending:false}).limit(100)]);
  if(materials.error || transformations.error) return <main className="content"><Link href="/">← Inicio</Link><h1>Transformaciones no disponibles</h1><p>Revisá la conexión y las migraciones.</p></main>;
  const name=(id:string)=>{const m=materials.data?.find(x=>x.id===id);return m ? `${m.name} (${m.unit})` : "Material";};
  return <main className="content"><Link href="/">← Inicio</Link><h1>Transformaciones de materiales</h1><p className="muted">Registra cantidades físicas de origen y resultado. La transformación aún no asigna costos ni lotes automáticamente.</p><TransformationForm materials={(materials.data ?? []).filter(m=>m.active)} operationKey={crypto.randomUUID()}/><section className="next"><h2>Últimas transformaciones</h2>{!transformations.data?.length && <p>No hay transformaciones registradas.</p>}{transformations.data?.map(t=><article className="tile" key={t.id}><p>{new Date(t.created_at).toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})} · {t.source_quantity} {name(t.source_material_id)} → {t.result_quantity} {name(t.result_material_id)}</p><p>{t.reason}</p></article>)}</section></main>;
}
