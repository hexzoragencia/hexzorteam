import { requireEspacio } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { PresupuestoClient } from "./presupuesto-client";

export default async function PresupuestoPage({
  params, searchParams,
}: {
  params: { slug: string };
  searchParams: { ano?: string; mes?: string };
}) {
  const espacio = await requireEspacio(params.slug);
  const now = new Date();
  const ano = parseInt(searchParams.ano ?? String(now.getFullYear()));
  const mes = parseInt(searchParams.mes ?? String(now.getMonth() + 1));

  const supabase = createClient();
  const [{ data: cats }, { data: pres }, { data: txs }] = await Promise.all([
    supabase.from("categorias").select("*").eq("espacio_id", espacio.id)
      .eq("activo", true).order("tipo").order("orden").order("nombre"),
    supabase.from("presupuestos_mensuales").select("*").eq("ano", ano).eq("mes", mes),
    supabase.from("transacciones")
      .select("monto,categoria_id,fecha")
      .eq("espacio_id", espacio.id)
      .gte("fecha", `${ano}-${String(mes).padStart(2, "0")}-01`)
      .lt("fecha", mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`),
  ]);

  return (
    <PresupuestoClient
      espacioId={espacio.id}
      moneda={espacio.moneda}
      ano={ano}
      mes={mes}
      slug={espacio.slug}
      categorias={cats ?? []}
      presupuestos={pres ?? []}
      transacciones={txs ?? []}
    />
  );
}
