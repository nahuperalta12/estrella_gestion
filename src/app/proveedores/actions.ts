"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type SupplierState = { message?: string; ok?: boolean };
export async function saveSupplier(_: SupplierState, form: FormData): Promise<SupplierState> {
  const parsed = z.object({
    id: z.union([z.literal(""), z.string().uuid()]),
    name: z.string().trim().min(1).max(120),
    contact: z.string().trim().max(120),
    phone: z.string().trim().max(40),
    email: z.union([z.literal(""), z.string().trim().email().max(254)]),
    notes: z.string().trim().max(2000),
    active: z.boolean(),
  }).safeParse({ id: form.get("id") ?? "", name: form.get("name"), contact: form.get("contact") ?? "", phone: form.get("phone") ?? "", email: form.get("email") ?? "", notes: form.get("notes") ?? "", active: form.get("active") === "on" });
  if (!parsed.success) return { message: "Revisá los datos y el formato del correo." };
  const db = await createClient();
  const p = parsed.data;
  const { error } = await db.rpc("save_supplier", { p_id: p.id || null, p_name: p.name, p_contact: p.contact, p_phone: p.phone, p_email: p.email, p_notes: p.notes, p_active: p.active });
  if (error) return { message: "No se pudo guardar. Verificá que el nombre no exista y que tengas permisos." };
  revalidatePath("/proveedores");
  return { ok: true, message: "Proveedor guardado." };
}
