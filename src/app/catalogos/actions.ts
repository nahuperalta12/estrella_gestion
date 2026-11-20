"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type CatalogState = { message?: string; created?: boolean };
const id = z.union([z.literal(""), z.string().uuid()]);
export async function saveCustomer(_: CatalogState, form: FormData): Promise<CatalogState> {
  const result = z.object({ id, name: z.string().trim().min(1).max(120), phone: z.string().trim().max(40), active: z.boolean() }).safeParse({ id: form.get("id"), name: form.get("name"), phone: form.get("phone"), active: form.get("active") === "on" });
  if (!result.success) return { message: "Revisá el nombre y el teléfono." };
  const db = await createClient(); const p = result.data;
  const { error } = await db.rpc("save_customer", { p_id: p.id || null, p_name: p.name, p_phone: p.phone, p_active: p.active });
  if (error) return { message: "No se pudo guardar el cliente. Revisá tus permisos y la conexión." };
  revalidatePath("/catalogos"); return { message: "Cliente guardado.", created: !p.id };
}
export async function saveProduct(_: CatalogState, form: FormData): Promise<CatalogState> {
  const result = z.object({ id, name: z.string().trim().min(1).max(120), size: z.string().trim().max(80), color: z.string().trim().max(80), description: z.string().trim().max(2000), price: z.coerce.number().finite().min(0).max(999999999999).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6), active: z.boolean() }).safeParse({ id: form.get("id"), name: form.get("name"), size: form.get("size"), color: form.get("color"), description: form.get("description"), price: form.get("price"), active: form.get("active") === "on" });
  if (!result.success) return { message: "Revisá los datos y el precio (hasta dos decimales)." };
  const db = await createClient(); const p = result.data;
  const { error } = await db.rpc("save_product", { p_id: p.id || null, p_name: p.name, p_size: p.size, p_color: p.color, p_description: p.description, p_price: p.price, p_active: p.active });
  if (error) return { message: "No se pudo guardar el producto. Revisá tus permisos y la conexión." };
  revalidatePath("/catalogos"); return { message: "Producto guardado.", created: !p.id };
}
