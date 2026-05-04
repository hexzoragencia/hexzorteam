import { requireEspacio } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { HabitosClient } from "./habitos-client";
import type { Habito, HabitoMarca } from "@/lib/types";

export default async function HabitosPage({
  params, searchParams,
}: { params: { slug: string }; searchParams: { ano?: string; mes?: string } }) {
  const espacio = await requireEspacio(params.slug);
  const now = new Date();
  const ano = Number(searchParams.ano) || now.getFullYear();
  const mes = Number(searchParams.mes) || (now.getMonth() + 1);
  const supabase = createClient();

  // Cargar hábitos no archivados
  const { data: habitos } = await supabase
    .from("habitos")
    .select("*")
    .eq("espacio_id", espacio.id)
    .eq("archivado", false)
    .order("orden", { ascending: true })
    .order("created_at", { ascending: true });

  const ids = (habitos ?? []).map((h: any) => h.id);

  // Marcas del año (para el heatmap y línea anual)
  let marcasAno: HabitoMarca[] = [];
  if (ids.length > 0) {
    const { data: m } = await supabase
      .from("habito_marcas")
      .select("habito_id, fecha")
      .in("habito_id", ids)
      .gte("fecha", `${ano}-01-01`)
      .lt("fecha", `${ano + 1}-01-01`);
    marcasAno = (m ?? []) as HabitoMarca[];
  }

  return (
    <HabitosClient
      espacio={espacio}
      ano={ano}
      mes={mes}
      initialHabitos={(habitos ?? []) as Habito[]}
      initialMarcas={marcasAno}
    />
  );
}
