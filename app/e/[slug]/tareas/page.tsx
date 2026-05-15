import { requireEspacio } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { TareasClient } from "./tareas-client";
import { redirect } from "next/navigation";

export default async function TareasPage({ params }: { params: { slug: string } }) {
  const espacio = await requireEspacio(params.slug);
  if (espacio.tipo !== "empresarial") redirect(`/e/${espacio.slug}/dashboard`);

  const supabase = createClient();
  const [{ data: tareas }, { data: miembros }, { data: productos }] = await Promise.all([
    supabase.from("emp_tareas").select("*").eq("espacio_id", espacio.id).order("created_at", { ascending: false }),
    supabase.from("espacio_miembros").select("perfil_id, perfiles(id,nombre)").eq("espacio_id", espacio.id),
    supabase.from("emp_productos").select("id, nombre").eq("espacio_id", espacio.id).order("nombre"),
  ]);

  return (
    <TareasClient
      espacioId={espacio.id}
      tareas={(tareas ?? []) as any}
      miembros={(miembros ?? []).map((m: any) => ({ id: m.perfiles?.id, nombre: m.perfiles?.nombre })).filter(m => m.id)}
      productos={(productos ?? []) as any}
    />
  );
}
