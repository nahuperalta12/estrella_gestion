import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditMaterialForm, MaterialForm, StockForm } from "./forms";

export const dynamic = "force-dynamic";
export default async function Inventory() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/ingresar");
  const { data: profile } = await db.from("profiles").select("role, active").eq("id", user.id).maybeSingle();
  if (!profile?.active || profile.role !== "admin") redirect("/");
  const [materials, balances, movements] = await Promise.all([
    db.from("materials").select("id,name,unit,minimum_stock,active").order("name"),
    db.from("warehouse_balances").select("material_id,quantity"),
    db.from("inventory_movements").select("id,material_id,quantity,reason,created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  if (materials.error || balances.error || movements.error) return <main className="content"><Link href="/">← Inicio</Link><h1>Inventario no disponible</h1><p>Verificá que la migración de inventario esté aplicada y que la conexión funcione.</p></main>;
  const items = materials.data ?? [];
  const activeItems = items.filter(m => m.active);
  return <main className="content"><Link href="/">← Inicio</Link><h1>Inventario del depósito</h1><p><Link href="/exportar/inventario" download prefetch={false}>Descargar inventario CSV</Link></p><p className="muted">Cargá materiales y ajustá existencias del depósito. Para editar o desactivar un material, abrilo en Administrar materiales.</p><section className="tile"><h2>Materiales</h2>{items.length === 0 ? <p>No hay materiales registrados.</p> : <div className="table-wrap"><table><thead><tr><th>Material</th><th>Disponible</th><th>Stock mínimo</th></tr></thead><tbody>{items.map(m => { const quantity = balances.data?.find(b => b.material_id === m.id)?.quantity ?? 0; return <tr key={m.id}><td>{m.name} {!m.active && "(inactivo)"}</td><td>{Number(quantity).toLocaleString("es-AR")} {m.unit}</td><td>{Number(m.minimum_stock).toLocaleString("es-AR")} {m.active && Number(quantity) <= Number(m.minimum_stock) && " · Stock bajo"}</td></tr>; })}</tbody></table></div>}</section><div className="grid"><MaterialForm/><StockForm materials={activeItems} operationKey={crypto.randomUUID()}/></div><section className="next"><h2>Administrar materiales</h2>{items.map(m => <details className="tile" key={m.id}><summary>{m.name} {!m.active && "(inactivo)"} — Editar</summary><EditMaterialForm material={m}/></details>)}</section><section className="tile next"><h2>Últimos movimientos</h2>{!movements.data?.length ? <p>No hay movimientos registrados.</p> : <ul>{movements.data.map(m => <li key={m.id}>{new Date(m.created_at).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })} · {items.find(i => i.id === m.material_id)?.name ?? "Material"}: {m.quantity} · {m.reason}</li>)}</ul>}</section></main>;
}
