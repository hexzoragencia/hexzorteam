import { requireEspacio } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { PlaneacionClient } from "./planeacion-client";
import { lunesDe, hoyIso, sumarDias } from "@/lib/fechas";
import type { Tarea } from "@/lib/types";

export default async function PlaneacionPage({
  params, searchParams,
}: { params: { slug: string }; searchParams: { semana?: string; vista?: string } }) {
  const espacio = await requireEspacio(params.slug);
  const semanaInicio = searchParams.semana ? lunesDe(searchParams.semana) : lunesDe(hoyIso());
  const semanaFin = sumarDias(semanaInicio, 7);
  const vista = (searchParams.vista === "dia" ? "dia" : "semana") as "dia" | "semana";

  const supabase = createClient();
  const { data: tareas } = await supabase
    .from("tareas")
    .select("*")
    .eq("espacio_id", espacio.id)
    .gte("fecha", semanaInicio)
    .lt("fecha", semanaFin)
    .order("hora_inicio", { ascending: true, nullsFirst: false })
    .order("orden");

  return (
    <PlaneacionClient
      espacio={espacio}
      semanaInicio={semanaInicio}
      vistaInicial={vista}
      initial={(tareas ?? []) as Tarea[]}
    />
  );
}
