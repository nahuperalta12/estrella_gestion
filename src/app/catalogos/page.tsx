import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomerForm, ProductForm, type Customer, type Product } from "./forms";

export const dynamic = "force-dynamic";
const money=(amount:number)=>Number(amount).toLocaleString("es-AR",{style:"currency",currency:"ARS"});

export default async function CatalogsPage() {
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user) redirect("/ingresar");
  const {data:profile}=await db.from("profiles").select("role,active").eq("id",user.id).maybeSingle();
  if(!profile?.active || profile.role!=="admin") redirect("/");
  const [customers,products]=await Promise.all([
    db.from("customers").select("id,name,phone,active").order("name"),
    db.from("products").select("id,name,size,color,description,suggested_price,active").order("name"),
  ]);
  if(customers.error || products.error) return <main className="content"><Link href="/">Inicio</Link><h1>Catálogos no disponibles</h1><p>Revisá la conexión y las migraciones de la base de datos.</p></main>;
  return <main className="content">
    <Link href="/cargas">Cargas y ABM</Link><h1>Clientes y productos</h1>
    <p className="muted">Consultá los registros y usá las acciones de cada fila para modificarlos o desactivarlos.</p>
    <section className="overview-section" aria-labelledby="customers-title">
      <div className="section-heading"><div><p className="section-kicker">CATÁLOGO</p><h2 id="customers-title">Clientes</h2></div></div>
      <details className="table-create" id="nuevo-cliente"><summary>Agregar cliente</summary><CustomerForm/></details>
      <div className="table-panel table-wrap"><table className="data-table"><thead><tr><th>Nombre</th><th>Teléfono</th><th>Estado</th><th className="actions-cell">Acciones</th></tr></thead><tbody>
        {(customers.data as Customer[]).map(item=><tr key={item.id}><td>{item.name}</td><td>{item.phone || "—"}</td><td><span className="status-pill">{item.active ? "Activo" : "Inactivo"}</span></td><td className="actions-cell"><details className="action-disclosure"><summary>Modificar</summary><CustomerForm item={item}/></details></td></tr>)}
      </tbody></table>{!customers.data?.length && <p className="table-empty">No hay clientes registrados.</p>}</div>
    </section>
    <section className="overview-section" aria-labelledby="products-title">
      <div className="section-heading"><div><p className="section-kicker">CATÁLOGO</p><h2 id="products-title">Productos</h2></div></div>
      <details className="table-create" id="nuevo-producto"><summary>Agregar producto</summary><ProductForm/></details>
      <div className="table-panel table-wrap"><table className="data-table"><thead><tr><th>Producto</th><th>Tamaño</th><th>Color</th><th className="numeric">Precio sugerido</th><th>Estado</th><th className="actions-cell">Acciones</th></tr></thead><tbody>
        {(products.data as Product[]).map(item=><tr key={item.id}><td>{item.name}</td><td>{item.size || "—"}</td><td>{item.color || "—"}</td><td className="numeric">{money(item.suggested_price)}</td><td><span className="status-pill">{item.active ? "Activo" : "Inactivo"}</span></td><td className="actions-cell"><details className="action-disclosure"><summary>Modificar</summary><ProductForm item={item}/></details></td></tr>)}
      </tbody></table>{!products.data?.length && <p className="table-empty">No hay productos registrados.</p>}</div>
    </section>
  </main>;
}
