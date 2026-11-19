import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupplierForm, type Supplier } from "./supplier-form";
export const dynamic = "force-dynamic";
export default async function Suppliers() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/ingresar");
  const { data: profile } = await db.from("profiles").select("role, active").eq("id", user.id).maybeSingle();
  if (!profile?.active || profile.role !== "admin") redirect("/");
  const { data, error } = await db.from("suppliers").select("id,name,contact,phone,email,notes,active").order("name");
  if (error) return <main className="content"><Link href="/">← Inicio</Link><h1>Proveedores no disponibles</h1><p>Revisá la conexión y la configuración de la base de datos.</p></main>;
  const suppliers: Supplier[] = data ?? [];
  return <main className="content"><Link href="/">← Inicio</Link><h1>Proveedores</h1><p className="muted">Administrá los datos de contacto de tus proveedores.</p><SupplierForm/><section className="next"><h2>Proveedores registrados</h2>{suppliers.length === 0 ? <p>No hay proveedores registrados.</p> : suppliers.map(supplier => <details className="tile" key={supplier.id}><summary>{supplier.name} {supplier.active ? "" : "· Inactivo"}</summary><SupplierForm supplier={supplier}/></details>)}</section></main>;
}
