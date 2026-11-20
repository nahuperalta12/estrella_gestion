import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";
export default async function SettingsPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/ingresar");
  const { data: profile } = await db.from("profiles").select("role,active").eq("id", user.id).maybeSingle();
  if (!profile?.active || profile.role !== "admin") redirect("/");
  const { data, error } = await db.from("inventory_settings").select("glue_grams_per_pot,glue_grams_per_feather,holographic_rods_per_kg,fiberglass_segments_per_rod").eq("id", true).single();
  if (error || !data) return <main className="content"><Link href="/">← Inicio</Link><h1>Configuración no disponible</h1><p>Revisá la conexión y las migraciones de la base de datos.</p></main>;
  return <main className="content"><Link href="/">← Inicio</Link><h1>Configuración de inventario</h1><p className="muted">Valores de referencia para estimaciones. Cambiarlos no modifica movimientos registrados ni recetas ya guardadas.</p><SettingsForm settings={data}/></main>;
}
