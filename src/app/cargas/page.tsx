import Link from "next/link";
import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
export const dynamic="force-dynamic";
const sections=[
  {title:"Materiales",description:"Crear, editar o desactivar materiales y registrar el stock inicial.",href:"/inventario#nuevo-material",action:"Administrar materiales"},
  {title:"Proveedores",description:"Cargar y mantener datos de contacto y estado.",href:"/proveedores#nuevo-proveedor",action:"Administrar proveedores"},
  {title:"Clientes",description:"Cargar clientes, editar teléfonos y dar de baja sin borrar su historial.",href:"/catalogos#nuevo-cliente",action:"Administrar clientes"},
  {title:"Productos",description:"Cargar modelos, tamaños, colores y precios sugeridos.",href:"/catalogos#nuevo-producto",action:"Administrar productos"},
  {title:"Colaboradoras",description:"Crear cuentas, editar nombres y activar o desactivar el acceso.",href:"/colaboradoras",action:"Administrar colaboradoras"},
  {title:"Recetas y asignaciones",description:"Cargar consumos por producto y asignar trabajos con tarifa.",href:"/produccion",action:"Ir a producción"},
  {title:"Compras",description:"Registrar compras, su recepción y los pagos realizados.",href:"/compras",action:"Ir a compras"},
  {title:"Pedidos",description:"Registrar pedidos, cobros y entregas a clientes.",href:"/pedidos",action:"Ir a pedidos"},
  {title:"Configuración",description:"Mantener los valores de referencia para materiales.",href:"/configuracion",action:"Ir a configuración"},
];
export default async function DataEntryPage() {
  const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user) redirect("/ingresar");
  const {data:profile}=await db.from("profiles").select("role,active").eq("id",user.id).maybeSingle();if(!profile?.active || profile.role!=="admin") redirect("/");
  return <main className="content"><Link href="/">← Inicio</Link><h1>Cargas y ABM</h1><p className="muted">Elegí qué información querés cargar. En cada listado, abrí un registro para editarlo o desactivarlo. Los movimientos confirmados conservan su historial.</p><div className="grid">{sections.map(s=><Link className="tile" key={s.title} href={s.href}><h2>{s.title}</h2><p>{s.description}</p><strong>{s.action} →</strong></Link>)}</div></main>;
}
