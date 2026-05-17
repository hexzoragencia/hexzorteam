import { requireEspacio, getMisEspacios } from "@/lib/espacio";
import { Nav } from "@/components/nav";
import { createClient } from "@/lib/supabase/server";
import { PomodoroWidget } from "@/components/pomodoro-widget";
import { CoachChat } from "@/components/coach-chat";
import { AparienciaApplier } from "@/components/apariencia-applier";
import { getPreferenciasEspacio } from "@/lib/preferencias-server";
import { hoyIso, sumarDias } from "@/lib/fechas";
import type { Tarea } from "@/lib/types";

export default async function EspacioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const espacio = await requireEspacio(params.slug);
  const espacios = await getMisEspacios();

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Preferencias específicas de este espacio (con fallback a globales)
  const prefsEspacio = await getPreferenciasEspacio(espacio.id);

  // Tareas pendientes para el selector del Pomodoro: hoy + próximos 7 días
  // Inclusivo para evitar problemas de timezone y permitir enfocarse en tareas futuras.
  // En empresarial puede que no haya tareas (solo personal las usa) — el query devuelve vacío.
  let tareasHoy: Tarea[] = [];
  try {
    const desde = sumarDias(hoyIso(), -1); // ayer en adelante (por si timezone)
    const hasta = sumarDias(hoyIso(), 7);
    const { data } = await supabase.from("tareas")
      .select("*")
      .eq("espacio_id", espacio.id)
      .eq("completada", false)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true })
      .order("hora_inicio", { ascending: true, nullsFirst: false });
    tareasHoy = (data ?? []) as Tarea[];
  } catch { /* tabla aún no existe */ }

  return (
    <div className="min-h-screen">
      {/* Aplica la apariencia específica de este espacio (sobrescribe la global) */}
      <AparienciaApplier prefs={prefsEspacio} />
      <Nav espacioActual={espacio} espacios={espacios} userEmail={user?.email} />
      <main className="md:pl-64">
        <div className="p-4 md:p-8 max-w-[1760px] mx-auto">{children}</div>
      </main>
      {/* Pomodoro: en ambos espacios */}
      <PomodoroWidget espacio={espacio} tareasHoy={tareasHoy} />
      {/* Coach IA chat: en ambos espacios */}
      <CoachChat espacioId={espacio.id} />
    </div>
  );
}
