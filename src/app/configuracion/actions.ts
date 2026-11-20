"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { message?: string };
const quantity = z.coerce.number().finite().positive().max(999999999999).refine(n => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-7);
export async function saveSettings(_: SettingsState, data: FormData): Promise<SettingsState> {
  const values = z.object({ pot: quantity, glue: quantity, rods: quantity, segments: z.coerce.number().int().positive().max(2147483647) }).safeParse({ pot: data.get("pot"), glue: data.get("glue"), rods: data.get("rods"), segments: data.get("segments") });
  if (!values.success) return { message: "Ingresá valores positivos; las cantidades admiten hasta tres decimales y los segmentos deben ser enteros." };
  const db = await createClient();
  const { error } = await db.rpc("update_inventory_settings", { p_pot: values.data.pot, p_glue: values.data.glue, p_rods: values.data.rods, p_segments: values.data.segments });
  if (error) return { message: "No se pudo guardar la configuración. Revisá la conexión y tus permisos." };
  revalidatePath("/configuracion");
  return { message: "Configuración guardada." };
}
