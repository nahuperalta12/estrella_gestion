import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
export const dynamic = "force-dynamic";
export default async function Home() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return <main className="login-page"><section className="login-card"><h1>Configuración pendiente</h1><p>Conectá Supabase siguiendo las instrucciones del README.</p></section></main>;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/ingresar");
  const { data: profile } = await supabase.from("profiles").select("display_name, role, active").eq("id", user.id).maybeSingle();
  if (!profile?.active) return <main className="login-page"><section className="login-card"><h1>Acceso no habilitado</h1><p>Contactá a la administración.</p><form action={signOut}><button>Cerrar sesión</button></form></section></main>;
  const admin = profile.role === "admin";
  return <div className="shell"><aside className="sidebar"><div className="brand"><span className="mark small">✦</span><div><strong>Estrella Gestión</strong><small>ESTRELLA CARNAVAL</small></div></div><nav aria-label="Navegación principal"><span className="nav-active">Inicio</span>{admin && <Link href="/inventario">Inventario</Link>}</nav><div className="side-bottom"><span>{admin ? "Administración" : "Colaboradora"}</span><form action={signOut}><button className="link-button">Cerrar sesión</button></form></div></aside><main className="content"><header><div><p className="eyebrow">TU ESPACIO DE TRABAJO</p><h1>Hola, {profile.display_name}</h1><p className="muted">{admin ? "Panel de administración" : "Tu portal de colaboradora"}</p></div><form action={signOut} className="mobile-signout"><button className="link-button">Cerrar sesión</button></form></header><section className="welcome"><div><p className="eyebrow">ESTRELLA GESTIÓN</p><h2>Tu espacio de trabajo</h2><p>Los módulos se incorporan gradualmente con información real y trazable.</p></div><span aria-hidden="true">✦</span></section><section className="next"><h2>Herramientas</h2><div className="grid">{admin && <Link className="tile" href="/inventario"><h3>Inventario</h3><p>Materiales y movimientos del depósito</p></Link>}<article className="tile"><h3>Producción</h3><p>Próximamente</p></article><article className="tile"><h3>Pedidos y finanzas</h3><p>Próximamente</p></article></div></section></main></div>;
}
