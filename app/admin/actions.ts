"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/espacio";

export async function aprobarUsuario(formData: FormData) {
  if (!(await isSuperAdmin())) throw new Error("No autorizado");
  const targetId = String(formData.get("target_id") ?? "");
  if (!targetId) throw new Error("Falta target_id");
  const supabase = createClient();
  const { error } = await supabase.rpc("aprobar_usuario", { target_id: targetId });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function rechazarUsuario(formData: FormData) {
  if (!(await isSuperAdmin())) throw new Error("No autorizado");
  const targetId = String(formData.get("target_id") ?? "");
  if (!targetId) throw new Error("Falta target_id");
  const supabase = createClient();
  const { error } = await supabase.rpc("rechazar_usuario", { target_id: targetId });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
