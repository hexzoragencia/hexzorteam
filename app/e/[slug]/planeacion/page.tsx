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
  const vista = (
    searchParams.vista === "dia" ? "dia" :
    searchParams.vista === "mes" ? "mes" :
    "semana"
  ) as "dia" | "semana" | "mes";

  // Cargo tareas suficientes:
  // - Para semana/dia: solo la semana
  // - Para mes: 3 meses atrás + 1 mes adelante (para navegación histórica)
  const desde = vista === "mes"
    ? sumarDias(hoyIso(), -100)        // ~3 meses atrás
    : semanaInicio;
  const hasta = vista === "mes"
    ? sumarDias(hoyIso(), 35)          // ~1 mes adelante
    : sumarDias(semanaInicio, 7);

  const supabase = createClient();
  const { data: tareas } = await supabase
    .from("tareas")
    .select("*")
    .eq("espacio_id", espacio.id)
    .gte("fecha", desde)
    .lt("fecha", hasta)
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
