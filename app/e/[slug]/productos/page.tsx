import { requireEspacio } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { ProductosClient } from "./productos-client";
import { redirect } from "next/navigation";

export default async function ProductosPage({ params }: { params: { slug: string } }) {
  const espacio = await requireEspacio(params.slug);
  if (espacio.tipo !== "empresarial") redirect(`/e/${espacio.slug}/dashboard`);

  const supabase = createClient();
  const [{ data: productos }, { data: archivados }, { data: miembros }] = await Promise.all([
    // Activos (no archivados). Usamos .or para que tolere filas viejas sin la columna.
    supabase.from("emp_productos").select("*").eq("espacio_id", espacio.id).or("archivado.is.null,archivado.eq.false").order("created_at", { ascending: false }),
    // Archivados (papelera, recuperables)
    supabase.from("emp_productos").select("*").eq("espacio_id", espacio.id).eq("archivado", true).order("created_at", { ascending: false }),
    supabase.from("espacio_miembros").select("perfil_id, perfiles(id,nombre,email)").eq("espacio_id", espacio.id),
  ]);

  return (
    <ProductosClient
      espacioId={espacio.id}
      moneda={espacio.moneda}
      productos={(productos ?? []) as any}
      archivados={(archivados ?? []) as any}
      miembros={(miembros ?? []).map((m: any) => ({ id: m.perfiles?.id, nombre: m.perfiles?.nombre })) as any}
    />
  );
}
