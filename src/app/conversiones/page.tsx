import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {Calculator} from "./calculator";
export const dynamic="force-dynamic";
export default async function ConversionsPage() {
  const db=await createClient(); const {data:{user}}=await db.auth.getUser(); if(!user) redirect("/ingresar");
  const {data:profile}=await db.from("profiles").select("role,active").eq("id",user.id).maybeSingle(); if(!profile?.active || profile.role!=="admin") redirect("/");
  const {data,error}=await db.from("inventory_settings").select("glue_grams_per_pot,glue_grams_per_feather,holographic_rods_per_kg,fiberglass_segments_per_rod").eq("id",true).single();
  if(error || !data) return <main className="content"><Link href="/">← Inicio</Link><h1>Conversiones no disponibles</h1><p>Revisá la conexión y las migraciones.</p></main>;
  return <main className="content"><Link href="/">← Inicio</Link><h1>Estimaciones de materiales</h1><p className="muted">Los cálculos usan la configuración actual. Son estimaciones y no registran compras, cortes ni movimientos de stock.</p><p><Link href="/configuracion">Editar valores de referencia</Link> · <Link href="/transformaciones">Registrar un corte efectivo</Link></p><Calculator settings={data}/></main>;
}
