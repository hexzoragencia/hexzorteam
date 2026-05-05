import { requireEspacio, getMisEspacios } from "@/lib/espacio";
import { Nav } from "@/components/nav";
import { createClient } from "@/lib/supabase/server";
import { PomodoroWidget } from "@/components/pomodoro-widget";
import { CoachChat } from "@/components/coach-chat";
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

  // Tareas pendientes para el selector del Pomodoro: hoy + próximos 7 días
  // Inclusivo para evitar problemas de timezone y permitir enfocarse en tareas futuras.
  let tareasHoy: Tarea[] = [];
  if (espacio.tipo === "personal") {
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
  }

  return (
    <div className="min-h-screen">
      <Nav espacioActual={espacio} espacios={espacios} userEmail={user?.email} />
      <main className="md:pl-64">
        <div className="p-4 md:p-8 max-w-6xl mx-auto">{children}</div>
      </main>
      {espacio.tipo === "personal" && (
        <>
          <PomodoroWidget espacio={espacio} tareasHoy={tareasHoy} />
          <CoachChat />
        </>
      )}
    </div>
  );
}
