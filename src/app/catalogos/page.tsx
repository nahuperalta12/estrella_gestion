import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomerForm, ProductForm, type Customer, type Product } from "./forms";

export const dynamic = "force-dynamic";
export default async function CatalogsPage() {
  const db = await createClient(); const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/ingresar");
  const { data: profile } = await db.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
  if (!profile?.active || profile.role !== "admin") redirect("/");
  const [customers, products] = await Promise.all([db.from("customers").select("id,name,phone,active").order("name"),db.from("products").select("id,name,size,color,description,suggested_price,active").order("name")]);
  if (customers.error || products.error) return <main className="content"><Link href="/">← Inicio</Link><h1>Catálogos no disponibles</h1><p>Revisá la conexión y las migraciones de la base de datos.</p></main>;
  return <main className="content"><Link href="/cargas">← Cargas y ABM</Link><h1>Clientes y productos</h1><p className="muted">Cargá clientes y productos. Para modificar o dar de baja un registro, abrilo en el listado.</p><div className="grid"><section className="tile" id="nuevo-cliente"><h2>Nuevo cliente</h2><CustomerForm/></section><section className="tile" id="nuevo-producto"><h2>Nuevo producto</h2><ProductForm/></section></div><section className="next"><h2>Clientes registrados</h2>{!customers.data?.length && <p>No hay clientes registrados.</p>}{(customers.data as Customer[]).map(item => <details className="tile" key={item.id}><summary>{item.name} {!item.active && "(inactivo)"} — Editar</summary><CustomerForm item={item}/></details>)}</section><section className="next"><h2>Productos registrados</h2>{!products.data?.length && <p>No hay productos registrados.</p>}{(products.data as Product[]).map(item => <details className="tile" key={item.id}><summary>{item.name} {item.size} {item.color} {!item.active && "(inactivo)"} — Editar</summary><ProductForm item={item}/></details>)}</section></main>;
}
