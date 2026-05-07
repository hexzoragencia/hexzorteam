import { requireEspacio } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { PagosClient } from "./pagos-client";

export default async function PagosPage({ params }: { params: { slug: string } }) {
  const espacio = await requireEspacio(params.slug);
  const supabase = createClient();

  const [{ data: pagos }, { data: categorias }] = await Promise.all([
    supabase.from("pagos_del_mes").select("*").eq("espacio_id", espacio.id).order("fecha_vencimiento"),
    supabase.from("categorias").select("id, nombre, tipo").eq("espacio_id", espacio.id).eq("activo", true)
      .in("tipo", ["pago_programado", "suscripcion", "gasto_mensual", "deuda"])
      .order("nombre"),
  ]);

  return (
    <PagosClient
      espacioId={espacio.id}
      moneda={espacio.moneda}
      pagos={(pagos ?? []) as any}
      categorias={(categorias ?? []) as any}
    />
  );
}
