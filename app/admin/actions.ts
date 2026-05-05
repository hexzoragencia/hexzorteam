"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { isSuperAdmin, getCurrentUser } from "@/lib/espacio";

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

export async function eliminarUsuario(formData: FormData) {
  if (!(await isSuperAdmin())) throw new Error("No autorizado");
  const targetId = String(formData.get("target_id") ?? "");
  if (!targetId) throw new Error("Falta target_id");
  const me = await getCurrentUser();
  if (me?.id === targetId) throw new Error("No puedes eliminarte a ti mismo");

  // Usar service role para borrar de auth.users (cascade borra perfil y todo lo demás)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Configuración inválida");
  const admin = createAdminClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await admin.auth.admin.deleteUser(targetId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
