"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin, getCurrentUser } from "@/lib/espacio";

async function requireAdmin() {
  if (!(await isSuperAdmin())) throw new Error("No autorizado");
}

// ============ ESTUDIANTES ============

export async function crearEstudiante(formData: FormData) {
  await requireAdmin();
  const user = await getCurrentUser();
  if (!user) throw new Error("Sesión inválida");
  const supabase = createClient();

  const payload = {
    superadmin_id: user.id,
    nombre: String(formData.get("nombre") ?? "").trim(),
    contacto: String(formData.get("contacto") ?? "").trim() || null,
    tipo: (String(formData.get("tipo") ?? "mentoria") as "mentoria" | "asesoria"),
    nivel: String(formData.get("nivel") ?? "").trim() || null,
    estado: (String(formData.get("estado") ?? "activo") as any),
    notas: String(formData.get("notas") ?? "").trim() || null,
    fecha_inicio: String(formData.get("fecha_inicio") ?? "") || null,
  };
  if (!payload.nombre) throw new Error("Falta nombre");

  const { data, error } = await supabase
    .from("mentorias_estudiantes")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/admin/mentorias");
  redirect(`/admin/mentorias/${data.id}`);
}

export async function actualizarEstudiante(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Falta id");
  const supabase = createClient();

  const payload: any = {};
  for (const k of ["nombre", "contacto", "tipo", "nivel", "estado", "notas", "fecha_inicio"]) {
    const v = formData.get(k);
    if (v !== null) {
      const s = String(v).trim();
      payload[k] = s === "" ? null : s;
    }
  }

  const { error } = await supabase.from("mentorias_estudiantes").update(payload).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/mentorias/${id}`);
  revalidatePath("/admin/mentorias");
}

export async function eliminarEstudiante(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Falta id");
  const supabase = createClient();
  const { error } = await supabase.from("mentorias_estudiantes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/mentorias");
  redirect("/admin/mentorias");
}

// ============ CLASES ============

export async function crearClase(formData: FormData) {
  await requireAdmin();
  const supabase = createClient();
  const estudianteId = String(formData.get("estudiante_id") ?? "");
  if (!estudianteId) throw new Error("Falta estudiante_id");

  // numero_orden = max + 1
  const { data: ult } = await supabase
    .from("mentorias_clases")
    .select("numero_orden")
    .eq("estudiante_id", estudianteId)
    .order("numero_orden", { ascending: false })
    .limit(1);
  const nextOrden = (ult?.[0]?.numero_orden ?? 0) + 1;

  const payload = {
    estudiante_id: estudianteId,
    numero_orden: nextOrden,
    titulo: String(formData.get("titulo") ?? "").trim(),
    descripcion: String(formData.get("descripcion") ?? "").trim() || null,
    fecha: String(formData.get("fecha") ?? "") || null,
    hora: String(formData.get("hora") ?? "") || null,
    duracion_min: Number(formData.get("duracion_min") ?? 60) || 60,
    estado: "pendiente" as const,
  };
  if (!payload.titulo) throw new Error("Falta título");

  const { error } = await supabase.from("mentorias_clases").insert(payload);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/mentorias/${estudianteId}`);
}

export async function actualizarClase(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const estudianteId = String(formData.get("estudiante_id") ?? "");
  if (!id) throw new Error("Falta id");
  const supabase = createClient();

  const payload: any = {};
  for (const k of ["titulo", "descripcion", "fecha", "hora", "duracion_min", "estado", "notas"]) {
    const v = formData.get(k);
    if (v !== null) {
      const s = String(v);
      if (k === "duracion_min") payload[k] = Number(s) || 60;
      else payload[k] = s.trim() === "" ? null : s.trim();
    }
  }

  const { error } = await supabase.from("mentorias_clases").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
  if (estudianteId) revalidatePath(`/admin/mentorias/${estudianteId}`);
}

export async function marcarClaseVista(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const estudianteId = String(formData.get("estudiante_id") ?? "");
  if (!id) throw new Error("Falta id");
  const supabase = createClient();
  const { error } = await supabase
    .from("mentorias_clases")
    .update({ estado: "vista", fecha_completada: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (estudianteId) revalidatePath(`/admin/mentorias/${estudianteId}`);
}

export async function reabrirClase(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const estudianteId = String(formData.get("estudiante_id") ?? "");
  if (!id) throw new Error("Falta id");
  const supabase = createClient();
  const { error } = await supabase
    .from("mentorias_clases")
    .update({ estado: "pendiente", fecha_completada: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (estudianteId) revalidatePath(`/admin/mentorias/${estudianteId}`);
}

export async function eliminarClase(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const estudianteId = String(formData.get("estudiante_id") ?? "");
  if (!id) throw new Error("Falta id");
  const supabase = createClient();
  const { error } = await supabase.from("mentorias_clases").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (estudianteId) revalidatePath(`/admin/mentorias/${estudianteId}`);
}
