import { requireEspacio } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { TransaccionesClient } from "./transacciones-client";

export default async function TransaccionesPage({ params }: { params: { slug: string } }) {
  const espacio = await requireEspacio(params.slug);
  const supabase = createClient();

  const [{ data: cats }, { data: txs }] = await Promise.all([
    supabase.from("categorias").select("*").eq("espacio_id", espacio.id)
      .eq("activo", true).order("tipo").order("nombre"),
    supabase.from("transacciones")
      .select("id,fecha,monto,descripcion,categoria_id,categorias(nombre,tipo),perfiles(nombre)")
      .eq("espacio_id", espacio.id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  return (
    <TransaccionesClient
      espacioId={espacio.id}
      moneda={espacio.moneda}
      categorias={cats ?? []}
      initialTxs={txs ?? []}
    />
  );
}
