"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Tarea, Espacio } from "@/lib/types";
import { Play, Pause, X, Coffee, Brain, ChevronUp, ChevronDown, Move } from "lucide-react";
import { hoyIso } from "@/lib/fechas";
import { useFloatingCorner, cornerClasses, cornerLabel } from "./floating-pos";

function etiquetaFecha(fecha: string): string {
  const hoyStr = hoyIso();
  if (fecha === hoyStr) return "Hoy";
  // Mañana
  const d = new Date(fecha + "T00:00:00");
  const hoyD = new Date(hoyStr + "T00:00:00");
  const diff = Math.round((d.getTime() - hoyD.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  if (diff > 1 && diff <= 7) {
    const dias = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
    return dias[d.getDay()];
  }
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

function fmtHoraCorta(hora: string | null): string {
  if (!hora) return "";
  const [h, m] = hora.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return ` ${h12}:${String(m).padStart(2,"0")}${ampm}`;
}

type Estado = "idle" | "trabajando" | "pausado" | "descansando" | "terminado";

interface PomoState {
  espacioId: string;
  tareaId: string | null;
  tareaTitulo: string | null;
  tipo: "trabajo" | "descanso";
  inicio: number;       // ms epoch
  duracionMin: number;
  pausadoEn: number | null;  // ms epoch cuando se pausó
  acumuladoMs: number;       // tiempo ya acumulado antes de pausar
  sesionId: string | null;   // id en supabase
}

const STORAGE_KEY = "pomodoro-state";
const DURACION_TRABAJO = 25;
const DURACION_DESCANSO = 5;

function fmtTiempo(ms: number): string {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function PomodoroWidget({ espacio, tareasHoy }: { espacio: Espacio; tareasHoy: Tarea[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [state, setState] = useState<PomoState | null>(null);
  const [now, setNow] = useState(Date.now());
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const audioFiredRef = useRef(false);
  const { corner, cycle } = useFloatingCorner();

  // Hidratar estado desde localStorage al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as PomoState;
        if (s.espacioId === espacio.id) setState(s);
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, [espacio.id]);

  // Guardar estado en localStorage
  useEffect(() => {
    if (!hydrated) return;
    if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
  }, [state, hydrated]);

  // Tick del cronómetro (1 vez por segundo)
  useEffect(() => {
    if (!state || state.pausadoEn !== null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [state?.pausadoEn, state?.inicio, state]);

  // Calcular tiempo restante (debe ejecutarse SIEMPRE, antes de cualquier early return,
  // para no romper el orden de hooks)
  let restanteMs = 0;
  let estado: Estado = "idle";
  let pctTranscurrido = 0;
  if (state) {
    const transcurrido = state.acumuladoMs + (state.pausadoEn !== null ? 0 : (now - state.inicio));
    const totalMs = state.duracionMin * 60 * 1000;
    restanteMs = totalMs - transcurrido;
    pctTranscurrido = Math.min(100, (transcurrido / totalMs) * 100);
    if (restanteMs <= 0) estado = "terminado";
    else if (state.pausadoEn !== null) estado = "pausado";
    else estado = state.tipo === "trabajo" ? "trabajando" : "descansando";
  }

  // Sonar/vibrar al terminar (una vez). Hook ANTES del early return para mantener el orden.
  useEffect(() => {
    if (estado === "terminado" && !audioFiredRef.current) {
      audioFiredRef.current = true;
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.3, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
        o.start(); o.stop(ctx.currentTime + 1.2);
        if ("vibrate" in navigator) navigator.vibrate([200, 100, 200, 100, 200]);
      } catch { /* ignore */ }
    }
    if (estado !== "terminado") audioFiredRef.current = false;
  }, [estado]);

  // Early return DESPUÉS de todos los hooks
  if (!hydrated) return null;

  async function iniciar(tareaId: string | null, tipo: "trabajo" | "descanso") {
    const tarea = tareaId ? tareasHoy.find(t => t.id === tareaId) ?? null : null;
    const dur = tipo === "trabajo" ? DURACION_TRABAJO : DURACION_DESCANSO;
    const inicio = Date.now();
    // Crear sesión en BD
    const { data } = await supabase.from("pomodoro_sesiones").insert({
      espacio_id: espacio.id, tarea_id: tareaId,
      duracion_planeada_min: dur, tipo,
      inicio: new Date(inicio).toISOString(),
    }).select().single();
    setState({
      espacioId: espacio.id, tareaId, tareaTitulo: tarea?.titulo ?? null,
      tipo, inicio, duracionMin: dur, pausadoEn: null, acumuladoMs: 0,
      sesionId: data?.id ?? null,
    });
  }

  function pausar() {
    if (!state || state.pausadoEn !== null) return;
    setState({ ...state, pausadoEn: Date.now() });
  }
  function reanudar() {
    if (!state || state.pausadoEn === null) return;
    const ahora = Date.now();
    const yaAcumulado = state.acumuladoMs + (state.pausadoEn - state.inicio);
    setState({ ...state, inicio: ahora, pausadoEn: null, acumuladoMs: yaAcumulado });
  }

  async function detener(completada = false) {
    if (state?.sesionId) {
      const transcurridoMin = Math.round(((state.acumuladoMs + (state.pausadoEn !== null ? 0 : (Date.now() - state.inicio))) / 60000));
      await supabase.from("pomodoro_sesiones").update({
        fin: new Date().toISOString(),
        duracion_real_min: transcurridoMin,
        completada,
      }).eq("id", state.sesionId);
    }
    setState(null);
    audioFiredRef.current = false;
    router.refresh();
  }

  async function marcarTareaCompletada() {
    if (!state?.tareaId) return;
    await supabase.from("tareas").update({ completada: true, completada_at: new Date().toISOString() }).eq("id", state.tareaId);
    await detener(true);
  }

  const tareasPendientes = tareasHoy.filter(t => !t.completada);
  const posClass = cornerClasses(corner);

  // ===== RENDER =====
  if (estado === "idle") {
    if (collapsed) {
      return (
        <button
          onClick={() => setCollapsed(false)}
          className={cn("fixed z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center brand-glow", posClass)}
          title="Abrir Pomodoro"
        >
          <Brain className="h-5 w-5" />
        </button>
      );
    }
    return (
      <div className={cn("fixed z-50 w-72 rounded-xl border bg-card shadow-2xl p-4 space-y-3", posClass)}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold flex items-center gap-1.5"><Brain className="h-4 w-4 text-primary" /> Pomodoro</span>
          <div className="flex items-center gap-0.5">
            <button onClick={cycle} className="text-muted-foreground hover:text-foreground p-1" title={`Mover (actual: ${cornerLabel(corner)})`}>
              <Move className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setCollapsed(true)} className="text-muted-foreground hover:text-foreground p-1"><ChevronDown className="h-4 w-4" /></button>
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Trabajar en…</label>
          <select
            id="pomo-tarea"
            className="w-full h-9 mt-1 rounded-md border border-input bg-background px-2 text-sm"
            defaultValue=""
          >
            <option value="">— Sin tarea específica —</option>
            {tareasPendientes.map(t => (
              <option key={t.id} value={t.id}>
                {etiquetaFecha(t.fecha)}{fmtHoraCorta(t.hora_inicio)} · {t.titulo}
              </option>
            ))}
          </select>
          {tareasPendientes.length === 0 && (
            <p className="text-[10px] text-muted-foreground mt-1">
              No hay tareas pendientes en los próximos 7 días.
            </p>
          )}
        </div>
        <Button
          className="w-full"
          onClick={() => {
            const sel = (document.getElementById("pomo-tarea") as HTMLSelectElement);
            iniciar(sel?.value || null, "trabajo");
          }}
        >
          <Play className="h-4 w-4 mr-1" /> Iniciar 25min
        </Button>
      </div>
    );
  }

  // ESTADO ACTIVO (trabajando, pausado, descansando, terminado)
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className={cn(
          "fixed z-50 h-14 px-4 rounded-full shadow-lg hover:scale-105 transition-transform flex items-center gap-2 text-sm font-semibold",
          posClass,
          estado === "terminado" ? "bg-success text-success-foreground" :
          estado === "pausado" ? "bg-orange-500 text-white" :
          state!.tipo === "descanso" ? "bg-emerald-500 text-white" :
          "bg-primary text-primary-foreground brand-glow"
        )}
      >
        <Brain className="h-4 w-4" />
        <span className="tabular-nums">{fmtTiempo(restanteMs)}</span>
      </button>
    );
  }

  const tipoColor =
    estado === "terminado" ? "border-success/50 bg-success/5" :
    estado === "pausado" ? "border-orange-500/50 bg-orange-500/5" :
    state!.tipo === "descanso" ? "border-emerald-500/50 bg-emerald-500/5" :
    "border-primary/50 bg-primary/5";

  return (
    <div className={cn("fixed z-50 w-80 rounded-xl border-2 bg-card shadow-2xl p-4 space-y-3", posClass, tipoColor)}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide font-semibold flex items-center gap-1.5">
          {state!.tipo === "descanso" ? <Coffee className="h-3.5 w-3.5" /> : <Brain className="h-3.5 w-3.5" />}
          {estado === "terminado" ? "¡Terminado!" :
           estado === "pausado"   ? "Pausado" :
           state!.tipo === "descanso" ? "Descanso" : "Enfocado"}
        </span>
        <div className="flex items-center gap-0.5">
          <button onClick={cycle} className="text-muted-foreground hover:text-foreground p-1" title={`Mover (${cornerLabel(corner)})`}>
            <Move className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setCollapsed(true)} className="text-muted-foreground hover:text-foreground p-1"><ChevronDown className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="text-center py-2">
        <div className="text-5xl font-bold tabular-nums">{fmtTiempo(restanteMs)}</div>
        {state!.tareaTitulo && <p className="text-xs text-muted-foreground mt-1 truncate">{state!.tareaTitulo}</p>}
      </div>

      {/* Barra de progreso */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn(
          "h-full transition-all",
          estado === "terminado" ? "bg-success" :
          state!.tipo === "descanso" ? "bg-emerald-500" : "bg-primary"
        )} style={{ width: `${pctTranscurrido}%` }} />
      </div>

      {/* Acciones según estado */}
      {estado === "terminado" ? (
        <div className="space-y-2">
          {state!.tipo === "trabajo" ? (
            <>
              <p className="text-xs text-success font-medium text-center">🎉 ¡Completaste tu pomodoro! Toma un descanso.</p>
              {state!.tareaId && (
                <Button className="w-full" variant="outline" onClick={marcarTareaCompletada}>
                  <Brain className="h-4 w-4 mr-1" /> Marcar tarea como hecha
                </Button>
              )}
              <Button className="w-full" onClick={() => { detener(true).then(() => iniciar(null, "descanso")); }}>
                <Coffee className="h-4 w-4 mr-1" /> Descanso de 5min
              </Button>
              <Button className="w-full" variant="ghost" onClick={() => detener(true)}>Terminar</Button>
            </>
          ) : (
            <>
              <p className="text-xs text-success font-medium text-center">☕ Descanso terminado. ¡A seguir!</p>
              <Button className="w-full" onClick={() => detener(true)}>Volver al trabajo</Button>
            </>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          {estado === "pausado" ? (
            <Button className="flex-1" onClick={reanudar}><Play className="h-4 w-4 mr-1" /> Continuar</Button>
          ) : (
            <Button className="flex-1" variant="outline" onClick={pausar}><Pause className="h-4 w-4 mr-1" /> Pausar</Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => detener(false)} title="Detener"><X className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}
