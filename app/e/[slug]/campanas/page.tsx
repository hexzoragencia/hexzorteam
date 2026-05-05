import { requireEspacio } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { CampanasClient } from "./campanas-client";
import { redirect } from "next/navigation";

export default async function CampanasPage({ params }: { params: { slug: string } }) {
  const espacio = await requireEspacio(params.slug);
  if (espacio.tipo !== "empresarial") redirect(`/e/${espacio.slug}/dashboard`);

  const supabase = createClient();
  const [{ data: campanas }, { data: productos }] = await Promise.all([
    supabase.from("emp_campanas_calc").select("*").eq("espacio_id", espacio.id).order("fecha", { ascending: false }).limit(500),
    supabase.from("emp_productos").select("id, nombre, costo_proveedor, precio_final").eq("espacio_id", espacio.id),
  ]);

  return (
    <CampanasClient
      espacioId={espacio.id}
      moneda={espacio.moneda}
      campanas={(campanas ?? []) as any}
      productos={(productos ?? []) as any}
    />
  );
}
