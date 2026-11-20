import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {DispatchForm,ReceiptForm} from "./forms";
export const dynamic="force-dynamic";
export default async function TransfersPage() {
  const db=await createClient(); const {data:{user}}=await db.auth.getUser(); if(!user) redirect("/ingresar");
  const {data:profile}=await db.from("profiles").select("role,active").eq("id",user.id).maybeSingle(); if(!profile?.active) redirect("/");
  const admin=profile.role==="admin";
  const [materials,transfers,custody,profiles]=await Promise.all([
    db.from("materials").select("id,name,unit,active").order("name"),
    db.from("stock_transfers").select("id,collaborator_id,material_id,quantity,notes,dispatched_at,received_at").order("dispatched_at",{ascending:false}).limit(100),
    db.from("custody_balances").select("collaborator_id,material_id,quantity"),
    admin ? db.from("profiles").select("id,display_name,role,active").order("display_name") : Promise.resolve({data:[],error:null})
  ]);
  if(materials.error || transfers.error || custody.error || profiles.error) return <main className="content"><Link href="/">← Inicio</Link><h1>Entregas no disponibles</h1><p>Revisá la conexión y las migraciones.</p></main>;
  const materialName=(id:string)=>materials.data?.find(m=>m.id===id);
  const personName=(id:string)=>profiles.data?.find(p=>p.id===id)?.display_name ?? "Colaboradora";
  return <main className="content"><Link href="/">← Inicio</Link><h1>{admin ? "Entregas de materiales":"Mis materiales"}</h1><p className="muted">Los materiales despachados quedan en tránsito hasta que la colaboradora confirme la recepción. Las diferencias y devoluciones todavía no están implementadas.</p>{admin && <DispatchForm operationKey={crypto.randomUUID()} collaborators={(profiles.data ?? []).filter(p=>p.active && p.role==="collaborator").map(p=>({id:p.id,name:p.display_name}))} materials={(materials.data ?? []).filter(m=>m.active)}/>}<section className="next"><h2>Materiales en custodia</h2>{!custody.data?.length && <p>No hay materiales recibidos.</p>}{custody.data?.map(c=><article className="tile" key={`${c.collaborator_id}-${c.material_id}`}><h3>{materialName(c.material_id)?.name ?? "Material"}</h3><p>{admin && `${personName(c.collaborator_id)} · `}{Number(c.quantity).toLocaleString("es-AR")} {materialName(c.material_id)?.unit}</p></article>)}</section><section className="next"><h2>{admin ? "Últimas entregas":"Mis entregas"}</h2>{!transfers.data?.length && <p>No hay entregas registradas.</p>}{transfers.data?.map(t=><article className="tile" key={t.id}><h3>{materialName(t.material_id)?.name ?? "Material"}</h3><p>{admin && `${personName(t.collaborator_id)} · `}{Number(t.quantity).toLocaleString("es-AR")} {materialName(t.material_id)?.unit} · {t.received_at ? "Recibida":"En tránsito"}</p>{t.notes && <p>{t.notes}</p>}{!admin && !t.received_at && <ReceiptForm id={t.id}/>}</article>)}</section></main>;
}
