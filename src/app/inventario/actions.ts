"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export type FormState = { error?: string; success?: string };
export async function updateMaterial(_: FormState, data: FormData): Promise<FormState> {
  const parsed = z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(120), minimum: z.coerce.number().finite().min(0).max(999999999999999).refine(n => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-7), active: z.boolean() }).safeParse({ id: data.get("id"), name: data.get("name"), minimum: data.get("minimum"), active: data.get("active") === "on" });
  if (!parsed.success) return { error: "Revisá el nombre y el stock mínimo (hasta tres decimales)." };
  const db = await createClient();
  const { error } = await db.rpc("update_material", { p_id: parsed.data.id, p_name: parsed.data.name, p_minimum_stock: parsed.data.minimum, p_active: parsed.data.active });
  if (error) return { error: "No se pudo guardar el material. Verificá el nombre y tus permisos." };
  revalidatePath("/inventario");
  return { success: "Material actualizado." };
}
export async function createMaterial(_: FormState, data: FormData): Promise<FormState> {
  const parsed = z.object({ name: z.string().trim().min(1).max(120), unit: z.string().trim().min(1).max(30), minimum: z.coerce.number().min(0).max(999999999999999) }).safeParse({ name: data.get("name"), unit: data.get("unit"), minimum: data.get("minimum") });
  if (!parsed.success) return { error: "Revisá el nombre, la unidad y el stock mínimo." };
  const db = await createClient();
  const { error } = await db.rpc("create_material", { p_name: parsed.data.name, p_unit: parsed.data.unit, p_minimum_stock: parsed.data.minimum });
  if (error) return { error: "No se pudo crear el material. Verificá que el nombre no exista y que tu cuenta tenga permisos." };
  revalidatePath("/inventario");
  return { success: "Material creado." };
}

export async function adjustStock(_: FormState, data: FormData): Promise<FormState> {
  const parsed = z.object({ key: z.string().uuid(), material: z.string().uuid(), quantity: z.coerce.number().finite().refine(n => n !== 0), reason: z.string().trim().min(1).max(500) }).safeParse({ key: data.get("key"), material: data.get("material"), quantity: data.get("quantity"), reason: data.get("reason") });
  if (!parsed.success) return { error: "Completá el material, la cantidad y el motivo." };
  const db = await createClient();
  const { error } = await db.rpc("adjust_warehouse_stock", { p_key: parsed.data.key, p_material: parsed.data.material, p_quantity: parsed.data.quantity, p_reason: parsed.data.reason });
  if (error) return { error: "No se pudo registrar el movimiento. Comprobá el stock disponible y los datos ingresados." };
  revalidatePath("/inventario");
  return { success: "Movimiento registrado." };
}
