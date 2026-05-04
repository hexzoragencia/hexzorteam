"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/ui/money-input";
import { formatMoney, formatDateLong, cn } from "@/lib/utils";
import {
  OBJETIVO_TIPOS, OBJETIVO_ESTADOS,
  type Objetivo, type ObjetivoSubtarea, type ObjetivoTipo, type ObjetivoEstado, type Espacio,
} from "@/lib/types";
import { Plus, Trash2, Pencil, Check, X, Target, ListChecks, ChevronDown } from "lucide-react";

type Form = {
  titulo: string; descripcion: string; tipo: ObjetivoTipo; estado: ObjetivoEstado;
  ingreso_esperado: number | ""; ganancia_esperada: number | ""; cantidad: number | "";
  progreso: number; fecha_limite: string;
};
const EMPTY: Form = {
  titulo: "", descripcion: "", tipo: "proyecto", estado: "en_progreso",
  ingreso_esperado: "", ganancia_esperada: "", cantidad: 1,
  progreso: 0, fecha_limite: "",
};

export function ObjetivosClient({
  espacio, initialObjetivos, initialSubtareas,
}: {
  espacio: Espacio; initialObjetivos: Objetivo[]; initialSubtareas: ObjetivoSubtarea[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [objetivos, setObjetivos] = useState<Objetivo[]>(initialObjetivos);
  const [subtareas, setSubtareas] = useState<ObjetivoSubtarea[]>(initialSubtareas);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [nuevaSubtarea, setNuevaSubtarea] = useState<Record<string, string>>({});
  const [filtroEstado, setFiltroEstado] = useState<ObjetivoEstado | "todos">("todos");

  const subtareasPorObj = useMemo(() => {
    const m: Record<string, ObjetivoSubtarea[]> = {};
    for (const s of subtareas) (m[s.objetivo_id] ??= []).push(s);
    return m;
  }, [subtareas]);

  function progresoCalc(o: Objetivo) {
    const subs = subtareasPorObj[o.id] ?? [];
    if (subs.length === 0) return o.progreso;
    return Math.round((subs.filter(s => s.completada).length / subs.length) * 100);
  }

  // Estado "efectivo" — refleja la realidad cuando hay sub-tareas
  function estadoEfectivo(o: Objetivo): { label: string; clase: string } {
    const subs = subtareasPorObj[o.id] ?? [];
    const totalSubs = subs.length;
    const hechas = subs.filter(s => s.completada).length;

    // Estados manuales que no se tocan
    if (o.estado === "pausado")    return { label: "Pausado",    clase: "bg-orange-500/15 text-orange-600" };
    if (o.estado === "cancelado")  return { label: "Cancelado",  clase: "bg-destructive/15 text-destructive" };
    if (o.estado === "backlog")    return { label: "Backlog",    clase: "bg-muted text-muted-foreground" };

    // Si tiene sub-tareas, el estado refleja el avance real
    if (totalSubs > 0) {
      if (hechas === 0)         return { label: "Sin empezar",       clase: "bg-muted text-muted-foreground" };
      if (hechas === totalSubs) return { label: "Completado",        clase: "bg-success/15 text-success" };
      return                            { label: `En progreso · ${hechas}/${totalSubs}`, clase: "bg-primary/15 text-primary" };
    }

    // Sin sub-tareas: usa el progreso manual
    if (o.estado === "completado" || o.progreso >= 100) return { label: "Completado", clase: "bg-success/15 text-success" };
    if (o.progreso === 0)                                return { label: "Sin empezar", clase: "bg-muted text-muted-foreground" };
    return                                                      { label: `En progreso · ${o.progreso}%`, clase: "bg-primary/15 text-primary" };
  }

  // Tras toggle de sub-tarea: si el avance llegó a 100% auto-marcamos completado;
  // si bajó, sacamos completado.
  async function syncEstadoConSubtareas(objetivoId: string, subsActualizadas: ObjetivoSubtarea[]) {
    const o = objetivos.find(x => x.id === objetivoId);
    if (!o) return;
    const subs = subsActualizadas.filter(s => s.objetivo_id === objetivoId);
    if (subs.length === 0) return;
    const hechas = subs.filter(s => s.completada).length;
    const todas = hechas === subs.length;

    if (todas && o.estado !== "completado") {
      const { data } = await supabase.from("objetivos").update({
        estado: "completado", progreso: 100, completado_at: new Date().toISOString(),
      }).eq("id", o.id).select().single();
      if (data) setObjetivos(objetivos.map(x => x.id === o.id ? (data as Objetivo) : x));
    } else if (!todas && o.estado === "completado") {
      const { data } = await supabase.from("objetivos").update({
        estado: "en_progreso", completado_at: null,
      }).eq("id", o.id).select().single();
      if (data) setObjetivos(objetivos.map(x => x.id === o.id ? (data as Objetivo) : x));
    }
  }

  // KPIs
  const totalObjetivos = objetivos.length;
  const completados = objetivos.filter(o => o.estado === "completado").length;
  const enProgreso = objetivos.filter(o => o.estado === "en_progreso").length;
  const ingresoTotal = objetivos
    .filter(o => o.tipo === "financiero" && o.estado !== "cancelado" && o.ingreso_esperado)
    .reduce((s, o) => s + Number(o.ingreso_esperado) * Number(o.cantidad ?? 1), 0);

  function startEdit(o: Objetivo) {
    setEditingId(o.id);
    setForm({
      titulo: o.titulo, descripcion: o.descripcion ?? "", tipo: o.tipo, estado: o.estado,
      ingreso_esperado: o.ingreso_esperado != null ? Number(o.ingreso_esperado) : "",
      ganancia_esperada: o.ganancia_esperada != null ? Number(o.ganancia_esperada) : "",
      cantidad: Number(o.cantidad ?? 1),
      progreso: o.progreso,
      fecha_limite: o.fecha_limite ?? "",
    });
    setShowForm(true);
  }

  function cancel() { setShowForm(false); setEditingId(null); setForm(EMPTY); }

  async function guardar() {
    const titulo = form.titulo.trim();
    if (!titulo) { alert("El título es requerido"); return; }
    const payload = {
      espacio_id: espacio.id, titulo,
      descripcion: form.descripcion.trim() || null,
      tipo: form.tipo, estado: form.estado,
      ingreso_esperado: form.ingreso_esperado === "" ? null : Number(form.ingreso_esperado),
      ganancia_esperada: form.ganancia_esperada === "" ? null : Number(form.ganancia_esperada),
      cantidad: Number(form.cantidad || 1),
      progreso: form.estado === "completado" ? 100 : Number(form.progreso || 0),
      fecha_limite: form.fecha_limite || null,
      completado_at: form.estado === "completado" ? new Date().toISOString() : null,
    };
    if (editingId) {
      const { data, error } = await supabase.from("objetivos").update(payload).eq("id", editingId).select().single();
      if (error) { alert(error.message); return; }
      setObjetivos(objetivos.map(o => o.id === editingId ? (data as Objetivo) : o));
    } else {
      const { data, error } = await supabase.from("objetivos").insert({ ...payload, orden: objetivos.length }).select().single();
      if (error) { alert(error.message); return; }
      setObjetivos([...objetivos, data as Objetivo]);
    }
    cancel();
    router.refresh();
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar este objetivo? Sus subtareas también se borrarán.")) return;
    const { error } = await supabase.from("objetivos").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setObjetivos(objetivos.filter(o => o.id !== id));
    router.refresh();
  }

  async function cambiarEstado(o: Objetivo, nuevo: ObjetivoEstado) {
    // Si tiene sub-tareas pendientes, no permitir marcar "completado" manualmente
    if (nuevo === "completado") {
      const subs = subtareasPorObj[o.id] ?? [];
      const pendientes = subs.filter(s => !s.completada).length;
      if (pendientes > 0) {
        alert(`No puedes marcar como completado: faltan ${pendientes} sub-tarea${pendientes > 1 ? "s" : ""} por terminar. Marca las que falten primero.`);
        return;
      }
    }
    const update: any = { estado: nuevo };
    if (nuevo === "completado") { update.progreso = 100; update.completado_at = new Date().toISOString(); }
    if (nuevo !== "completado" && o.estado === "completado") update.completado_at = null;
    const { data, error } = await supabase.from("objetivos").update(update).eq("id", o.id).select().single();
    if (error) { alert(error.message); return; }
    setObjetivos(objetivos.map(x => x.id === o.id ? (data as Objetivo) : x));
    router.refresh();
  }

  async function agregarSubtarea(objetivoId: string) {
    const titulo = (nuevaSubtarea[objetivoId] ?? "").trim();
    if (!titulo) return;
    const { data, error } = await supabase.from("objetivo_subtareas").insert({
      objetivo_id: objetivoId, titulo, orden: (subtareasPorObj[objetivoId] ?? []).length,
    }).select().single();
    if (error) { alert(error.message); return; }
    setSubtareas([...subtareas, data as ObjetivoSubtarea]);
    setNuevaSubtarea({ ...nuevaSubtarea, [objetivoId]: "" });
  }

  async function toggleSubtarea(s: ObjetivoSubtarea) {
    const { data, error } = await supabase.from("objetivo_subtareas").update({ completada: !s.completada }).eq("id", s.id).select().single();
    if (error) { alert(error.message); return; }
    const updated = subtareas.map(x => x.id === s.id ? (data as ObjetivoSubtarea) : x);
    setSubtareas(updated);
    // Sincronizar estado del objetivo con el avance real de sus sub-tareas
    await syncEstadoConSubtareas(s.objetivo_id, updated);
    router.refresh();
  }

  async function borrarSubtarea(id: string) {
    const { error } = await supabase.from("objetivo_subtareas").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setSubtareas(subtareas.filter(s => s.id !== id));
  }

  function toggleExpand(id: string) {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  }

  // Filtrado por estado y orden estable
  const filtrados = filtroEstado === "todos"
    ? objetivos
    : objetivos.filter(o => o.estado === filtroEstado);

  const ESTADO_ORDER: Record<ObjetivoEstado, number> = {
    en_progreso: 0, backlog: 1, pausado: 2, completado: 3, cancelado: 4,
  };
  const orderedFiltrados = [...filtrados].sort((a, b) =>
    (ESTADO_ORDER[a.estado] - ESTADO_ORDER[b.estado]) || a.orden - b.orden
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Objetivos</h1>
          <p className="text-muted-foreground text-sm mt-1">Tus metas grandes con avance y proyección.</p>
        </div>
        {!showForm && (
          <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY); }}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo
          </Button>
        )}
      </div>

      {/* KPIs simplificados (3 en vez de 4) */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total" value={String(totalObjetivos)} hint={`${enProgreso} en progreso`} />
        <Stat label="Completados" value={String(completados)} hint={totalObjetivos > 0 ? `${((completados / totalObjetivos) * 100).toFixed(0)}% del total` : ""} />
        <Stat label="Ingreso proyectado" value={formatMoney(ingresoTotal, espacio.moneda)} hint="Suma de los financieros activos" />
      </div>

      {/* Filtros por estado */}
      {objetivos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-sm">
          <FilterPill active={filtroEstado === "todos"} onClick={() => setFiltroEstado("todos")} count={objetivos.length}>Todos</FilterPill>
          {OBJETIVO_ESTADOS.map(e => {
            const n = objetivos.filter(o => o.estado === e.value).length;
            if (n === 0) return null;
            return (
              <FilterPill key={e.value} active={filtroEstado === e.value} onClick={() => setFiltroEstado(e.value)} count={n}>
                {e.label}
              </FilterPill>
            );
          })}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">{editingId ? "Editar objetivo" : "Nuevo objetivo"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Título</label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej. Lanzar tienda Colombia" autoFocus />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Descripción (opcional)</label>
                <Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Detalles, contexto..." rows={2} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tipo</label>
                <select className="h-11 w-full rounded-md border border-input bg-background px-3" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as ObjetivoTipo })}>
                  {OBJETIVO_TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Estado</label>
                <select className="h-11 w-full rounded-md border border-input bg-background px-3" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as ObjetivoEstado })}>
                  {OBJETIVO_ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              {form.tipo === "financiero" && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Ingreso esperado por unidad</label>
                    <MoneyInput value={form.ingreso_esperado} onValueChange={(v) => setForm({ ...form, ingreso_esperado: v })} placeholder="4,000,000" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Ganancia esperada por unidad</label>
                    <MoneyInput value={form.ganancia_esperada} onValueChange={(v) => setForm({ ...form, ganancia_esperada: v })} placeholder="20,000,000" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Cantidad</label>
                    <Input type="number" inputMode="numeric" min="1" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value === "" ? "" : Number(e.target.value) })} />
                  </div>
                </>
              )}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Fecha límite (opcional)</label>
                <Input type="date" value={form.fecha_limite} onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Avance: {form.progreso}%</label>
                <input type="range" min="0" max="100" step="5" value={form.progreso} onChange={(e) => setForm({ ...form, progreso: Number(e.target.value) })} className="w-full" />
                <p className="text-xs text-muted-foreground">Si tiene sub-tareas, el avance se calcula solo.</p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={guardar}>Guardar</Button>
              <Button variant="outline" onClick={cancel}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* LISTA */}
      {objetivos.length === 0 && !showForm ? (
        <Card>
          <CardContent className="pt-6 text-center space-y-3 py-12">
            <Target className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aún no tienes objetivos.</p>
            <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY); }}>
              <Plus className="h-4 w-4 mr-1" /> Crear el primero
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {orderedFiltrados.map((o) => {
            const subs = subtareasPorObj[o.id] ?? [];
            const subsCompletadas = subs.filter(s => s.completada).length;
            const totalSubs = subs.length;
            const prog = progresoCalc(o);
            const isExpanded = expanded.has(o.id);
            const isCompleto = o.estado === "completado";
            const efectivo = estadoEfectivo(o);

            return (
              <Card key={o.id} className={cn(isCompleto && "opacity-60")}>
                <CardContent className="pt-5 pb-4 space-y-3">
                  {/* Línea 1: estado efectivo · título · acciones */}
                  <div className="flex items-start gap-3">
                    <span className={cn("text-[11px] uppercase tracking-wide font-medium px-2 py-0.5 rounded shrink-0 mt-0.5", efectivo.clase)}>
                      {efectivo.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h3 className={cn("font-semibold text-base leading-tight", isCompleto && "line-through")}>{o.titulo}</h3>
                      {o.descripcion && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{o.descripcion}</p>}
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(o)} className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => borrar(o.id)} className="h-7 w-7"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>

                  {/* Línea 2: barra de avance + conteo prominente de sub-tareas */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                        <div className={cn("h-full transition-all", prog >= 100 ? "bg-success" : "bg-primary")} style={{ width: `${prog}%` }} />
                      </div>
                      <span className="text-sm tabular-nums font-semibold w-12 text-right">{prog}%</span>
                    </div>
                    {totalSubs > 0 && (
                      <p className="text-xs text-muted-foreground tabular-nums">
                        <span className="font-medium text-foreground">{subsCompletadas} de {totalSubs}</span> sub-tareas completadas
                        {totalSubs - subsCompletadas > 0 && <span> · faltan {totalSubs - subsCompletadas}</span>}
                      </p>
                    )}
                  </div>

                  {/* Línea 3: meta data inline (solo lo importante, sin duplicar sub-tareas) */}
                  {(o.tipo === "financiero" || o.fecha_limite) && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {o.tipo === "financiero" && o.ingreso_esperado != null && (
                        <span>
                          Ingreso: <span className="font-medium text-foreground tabular-nums">{formatMoney(Number(o.ingreso_esperado) * o.cantidad, espacio.moneda)}</span>
                          {o.cantidad > 1 && <span className="text-muted-foreground"> ({o.cantidad}×)</span>}
                        </span>
                      )}
                      {o.tipo === "financiero" && o.ganancia_esperada != null && (
                        <span>
                          Ganancia: <span className="font-medium text-success tabular-nums">{formatMoney(Number(o.ganancia_esperada) * o.cantidad, espacio.moneda)}</span>
                        </span>
                      )}
                      {o.fecha_limite && (
                        <span>Para: <span className="font-medium text-foreground">{formatDateLong(o.fecha_limite)}</span></span>
                      )}
                    </div>
                  )}

                  {/* Línea 4: acciones secundarias (estado dropdown + sub-tareas) */}
                  <div className="flex items-center justify-between pt-1 border-t">
                    <button
                      onClick={() => toggleExpand(o.id)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                      {totalSubs > 0
                        ? (isExpanded ? "Ocultar sub-tareas" : `Ver sub-tareas (${subsCompletadas}/${totalSubs})`)
                        : (isExpanded ? "Ocultar" : "Agregar sub-tareas")}
                    </button>
                    <select
                      value={o.estado}
                      onChange={(e) => cambiarEstado(o, e.target.value as ObjetivoEstado)}
                      className="text-xs h-7 rounded border border-border bg-background px-2 text-muted-foreground hover:border-primary transition-colors"
                    >
                      {OBJETIVO_ESTADOS.map(e => (
                        <option key={e.value} value={e.value}>Mover a: {e.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sub-tareas (colapsadas por defecto) */}
                  {isExpanded && (
                    <div className="space-y-1.5 pt-2 border-t">
                      {subs.map(s => (
                        <div key={s.id} className="flex items-center gap-2 text-sm group">
                          <input type="checkbox" checked={s.completada} onChange={() => toggleSubtarea(s)} className="rounded shrink-0" />
                          <span className={cn("flex-1", s.completada && "line-through text-muted-foreground")}>{s.titulo}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => borrarSubtarea(s.id)}><X className="h-3 w-3" /></Button>
                        </div>
                      ))}
                      <div className="flex gap-1.5 pt-1">
                        <Input
                          placeholder="Nueva sub-tarea..."
                          value={nuevaSubtarea[o.id] ?? ""}
                          onChange={(e) => setNuevaSubtarea({ ...nuevaSubtarea, [o.id]: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && agregarSubtarea(o.id)}
                          className="h-8 text-sm"
                        />
                        <Button size="icon" className="h-8 w-8" onClick={() => agregarSubtarea(o.id)}><Plus className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1 truncate">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function FilterPill({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full border text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/40"
      )}
    >
      {children} {count !== undefined && <span className={cn("ml-1 opacity-70")}>{count}</span>}
    </button>
  );
}
