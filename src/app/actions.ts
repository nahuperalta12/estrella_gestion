"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export async function signIn(_: string | null, formData: FormData): Promise<string | null> {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1).max(1024) }).safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return "Ingres? un correo y una contrase?a v?lidos.";
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return "Falta configurar la conexi?n con Supabase.";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return "No pudimos iniciar sesi?n. Revis? tus datos o contact? a la administraci?n.";
  redirect("/");
}
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/ingresar");
}
