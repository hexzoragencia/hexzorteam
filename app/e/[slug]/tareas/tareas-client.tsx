"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ListTodo, Plus, Trash2, Pencil, Save, X as Close, Search,
  CheckCircle2, Circle, Clock, AlertTriangle, Flame, Calendar,
  User as UserIcon, ChevronDown, Package, MoreHorizontal, Info,
} from "lucide-react";

type Estado = "pendiente" | "en_progreso" | "hecha";
type Prioridad = "baja" | "media" | "alta" | "urgente";

type Tarea = {
  id: string;
  espacio_id: string;
  titulo: string;
  descripcion: string | null;
  estado: Estado;
  prioridad: Prioridad;
  asignado: string | null;
  fecha_limite: string | null;
  producto_id: string | null;
  completada_at: string | null;
  created_at: string;
};

const ESTADOS: { value: Estado; label: string; ayuda: string; icon: any; dot: string; text: string; bg: string; border: string }[] = [
  { value: "pendiente",    label: "Pendientes",   ayuda: "Aún sin empezar. Lo que hay que hacer.",      icon: Circle,        dot: "bg-zinc-400",    text: "text-zinc-500",                        bg: "bg-zinc-500/10",    border: "border-zinc-500/30" },
  { value: "en_progreso",  label: "En progreso",  ayuda: "Alguien ya la está haciendo ahora.",          icon: Clock,         dot: "bg-amber-500",   text: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30" },
  { value: "hecha",        label: "Hechas",       ayuda: "Terminadas. Buen trabajo.",                   icon: CheckCircle2,  dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
];

const PRIORIDADES: { value: Prioridad; label: string; color: string; icon?: any }[] = [
  { value: "baja",     label: "Baja",     color: "bg-zinc-500/15 text-zinc-500" },
  { value: "media",    label: "Media",    color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  { value: "alta",     label: "Alta",     color: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: AlertTriangle },
  { value: "urgente",  label: "Urgente",  color: "bg-rose-500/15 text-rose-600 dark:text-rose-400", icon: Flame },
];

function iniciales(s?: string | null) {
  if (!s) return "?";
  return s.split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase() ?? "").join("");
}

function diasHasta(fechaIso: string | null): number | null {
  if (!fechaIso) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const f = new Date(fechaIso + "T00:00:00");
  return Math.round((f.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

function formatFecha(fechaIso: string | null): string {
  if (!fechaIso) return "";
  const d = diasHasta(fechaIso);
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  if (d === -1) return "Ayer";
  if (d !== null && d > 0 && d <= 7) return `En ${d} días`;
  if (d !== null && d < 0) return `Hace ${-d} días`;
  return new Date(fechaIso + "T00:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

type FormState = {
  titulo: string;
  descripcion: string;
  estado: Estado;
  prioridad: Prioridad;
  asignado: string;
  fecha_limite: string;
  producto_id: string;
};

const FORM_DEFAULT: FormState = {
  titulo: "",
  descripcion: "",
  estado: "pendiente",
  prioridad: "media",
  asignado: "",
  fecha_limite: "",
  producto_id: "",
};

export function TareasClient({ espacioId, tareas: initial, miembros, productos }: {
  espacioId: string;
  tareas: Tarea[];
  miembros: { id: string; nombre: string }[];
  productos: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [tareas, setTareas] = useState<Tarea[]>(initial);
  const [busqueda, setBusqueda] = useState("");
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>("todas");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  // Drag & drop
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Estado | null>(null);

  // Filtrar
  const filtradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return tareas.filter(t => {
      if (filtroPrioridad !== "todas" && t.prioridad !== filtroPrioridad) return false;
      if (q && !(t.titulo.toLowerCase().includes(q) || (t.asignado ?? "").toLowerCase().includes(q) || (t.descripcion ?? "").toLowerCase().includes(q))) return false;
      return true;
    });
  }, [tareas, busqueda, filtroPrioridad]);

  // Agrupar por estado
  const porEstado = useMemo(() => {
    const m: Record<Estado, Tarea[]> = { pendiente: [], en_progreso: [], hecha: [] };
    for (const t of filtradas) m[t.estado].push(t);
    return m;
  }, [filtradas]);

  // Conteos por prioridad (para filtros)
  const countPrioridad = useMemo(() => {
    const m: Record<string, number> = { todas: tareas.length };
    for (const p of PRIORIDADES) m[p.value] = 0;
    for (const t of tareas) m[t.prioridad] = (m[t.prioridad] ?? 0) + 1;
    return m;
  }, [tareas]);

  // "Para hoy" — tareas NO hechas vencidas o que vencen hoy
  const hoyIso = (() => {
    const d = new Date(); d.setHours(0,0,0,0);
    return d.toISOString().slice(0, 10);
  })();
  const paraHoy = useMemo(() => {
    return tareas
      .filter(t => t.estado !== "hecha" && t.fecha_limite && t.fecha_limite <= hoyIso)
      .sort((a, b) => (a.fecha_limite ?? "").localeCompare(b.fecha_limite ?? ""));
  }, [tareas, hoyIso]);

  // "Qué le toca a cada uno" — tareas activas (no hechas) agrupadas por persona
  const porPersona = useMemo(() => {
    const m: Record<string, Tarea[]> = {};
    for (const t of tareas) {
      if (t.estado === "hecha") continue;
      const k = t.asignado?.trim() || "Sin asignar";
      (m[k] ??= []).push(t);
    }
    return Object.entries(m).sort((a, b) => b[1].length - a[1].length);
  }, [tareas]);

  // ===== DRAG & DROP =====
  function onDropEnColumna(estado: Estado) {
    setDragOver(null);
    const id = draggingId;
    setDraggingId(null);
    if (!id) return;
    const t = tareas.find(x => x.id === id);
    if (!t || t.estado === estado) return;
    cambiarEstado(id, estado);
  }

  function abrirCrear(estadoDefault: Estado = "pendiente") {
    setForm({ ...FORM_DEFAULT, estado: estadoDefault });
    setEditing(null);
    setShowForm(true);
  }

  function abrirEditar(t: Tarea) {
    setForm({
      titulo: t.titulo,
      descripcion: t.descripcion ?? "",
      estado: t.estado,
      prioridad: t.prioridad,
      asignado: t.asignado ?? "",
      fecha_limite: t.fecha_limite ?? "",
      producto_id: t.producto_id ?? "",
    });
    setEditing(t.id);
    setShowForm(true);
  }

  function cancelar() {
    setShowForm(false);
    setEditing(null);
    setForm(FORM_DEFAULT);
  }

  async function guardar() {
    const titulo = form.titulo.trim();
    if (!titulo) { alert("Falta el título"); return; }
    setSaving(true);
    const payload: any = {
      espacio_id: espacioId,
      titulo,
      descripcion: form.descripcion.trim() || null,
      estado: form.estado,
      prioridad: form.prioridad,
      asignado: form.asignado.trim() || null,
      fecha_limite: form.fecha_limite || null,
      producto_id: form.producto_id || null,
      completada_at: form.estado === "hecha" ? new Date().toISOString() : null,
    };
    if (editing) {
      const { data, error } = await supabase.from("emp_tareas").update(payload).eq("id", editing).select().single();
      setSaving(false);
      if (error) { alert(error.message); return; }
      setTareas(tareas.map(t => t.id === editing ? (data as Tarea) : t));
    } else {
      const { data, error } = await supabase.from("emp_tareas").insert(payload).select().single();
      setSaving(false);
      if (error) { alert(error.message); return; }
      setTareas([data as Tarea, ...tareas]);
    }
    cancelar();
    router.refresh();
  }

  async function borrar(id: string, titulo: string) {
    if (!confirm(`¿Borrar la tarea "${titulo}"?`)) return;
    const { error } = await supabase.from("emp_tareas").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setTareas(tareas.filter(t => t.id !== id));
    router.refresh();
  }

  async function cambiarEstado(id: string, nuevo: Estado) {
    setMenuAbierto(null);
    const completada_at = nuevo === "hecha" ? new Date().toISOString() : null;
    const { error } = await supabase.from("emp_tareas")
      .update({ estado: nuevo, completada_at }).eq("id", id);
    if (error) { alert(error.message); return; }
    setTareas(tareas.map(t => t.id === id ? { ...t, estado: nuevo, completada_at } : t));
    router.refresh();
  }

  async function toggleHecha(t: Tarea) {
    const nuevo: Estado = t.estado === "hecha" ? "pendiente" : "hecha";
    await cambiarEstado(t.id, nuevo);
  }

  function nombreProducto(id: string | null) {
    if (!id) return null;
    return productos.find(p => p.id === id)?.nombre ?? null;
  }

  return (
    <div className="space-y-5" onClick={() => setMenuAbierto(null)}>
      {/* HEADER */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-xl bg-primary/20 blur-md"></div>
            <ListTodo className="h-5 w-5 text-primary relative" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tareas del equipo</h1>
            <p className="text-xs text-muted-foreground">
              {tareas.length} {tareas.length === 1 ? "tarea" : "tareas"} ·
              {" "}{porEstado.pendiente.length} pendientes ·
              {" "}{porEstado.en_progreso.length} en progreso ·
              {" "}{porEstado.hecha.length} hechas
            </p>
          </div>
        </div>
        <Button onClick={() => abrirCrear()} className="shadow-md shadow-primary/20">
          <Plus className="h-4 w-4 mr-1.5" /> Nueva tarea
        </Button>
      </div>

      {/* BUSCADOR + FILTRO PRIORIDAD */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por título, asignado o descripción…"
            className="pl-10 h-11"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <ChipFiltro
            label="Todas"
            count={countPrioridad.todas ?? 0}
            activo={filtroPrioridad === "todas"}
            onClick={() => setFiltroPrioridad("todas")}
          />
          {PRIORIDADES.map(p => (
            <ChipFiltro
              key={p.value}
              label={p.label}
              count={countPrioridad[p.value] ?? 0}
              activo={filtroPrioridad === p.value}
              color={p.color}
              onClick={() => setFiltroPrioridad(p.value)}
            />
          ))}
        </div>
      </div>

      {/* FORM */}
      {showForm && (
        <div className="rounded-xl border border-primary/30 bg-card shadow-lg shadow-primary/5 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center gap-2">
              {editing ? <Pencil className="h-4 w-4 text-primary" /> : <Plus className="h-4 w-4 text-primary" />}
              <h3 className="font-semibold text-sm">{editing ? "Editar tarea" : "Nueva tarea"}</h3>
            </div>
            <button onClick={cancelar} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
              <Close className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Título *</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ej. Actualizar landing del Mosaico"
                autoFocus
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Descripción / detalles</Label>
              <textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                placeholder="Pasos, contexto, links útiles…"
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
              />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Estado</Label>
                <select
                  value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value as Estado })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Prioridad</Label>
                <select
                  value={form.prioridad}
                  onChange={(e) => setForm({ ...form, prioridad: e.target.value as Prioridad })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Asignado a</Label>
                <Input
                  list="hexzor-miembros-tareas"
                  value={form.asignado}
                  onChange={(e) => setForm({ ...form, asignado: e.target.value })}
                  placeholder="Valentina, Sebas…"
                  className="h-10"
                />
                <datalist id="hexzor-miembros-tareas">
                  {miembros.map(m => <option key={m.id} value={m.nombre} />)}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Fecha límite</Label>
                <Input
                  type="date"
                  value={form.fecha_limite}
                  onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })}
                  className="h-10"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Producto relacionado (opcional)</Label>
              <select
                value={form.producto_id}
                onChange={(e) => setForm({ ...form, producto_id: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">— Sin vincular —</option>
                {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 px-4 py-3 bg-muted/30 border-t">
            <Button variant="outline" onClick={cancelar}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving} className="shadow-md shadow-primary/20">
              <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando…" : (editing ? "Guardar cambios" : "Crear tarea")}
            </Button>
          </div>
        </div>
      )}

      {/* ===== PARA HOY ===== */}
      {paraHoy.length > 0 && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-rose-500/20 flex items-center gap-2">
            <Flame className="h-4 w-4 text-rose-500" />
            <h2 className="text-sm font-semibold">Para hoy / atrasadas</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold">
              {paraHoy.length}
            </span>
            <span className="text-[11px] text-muted-foreground ml-1">— esto es lo que toca resolver YA</span>
          </div>
          <div className="p-3 space-y-2">
            {paraHoy.map(t => (
              <div key={t.id} className="flex items-center gap-3 rounded-lg bg-card border border-border px-3 py-2">
                <button
                  onClick={() => toggleHecha(t)}
                  className="shrink-0 h-5 w-5 rounded-md border-2 border-border hover:border-emerald-500 flex items-center justify-center"
                  title="Marcar como hecha"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{t.titulo}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {t.asignado ? `${t.asignado} · ` : ""}
                    {t.fecha_limite === hoyIso ? "vence hoy" : `vencida (${t.fecha_limite})`}
                  </div>
                </div>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold shrink-0",
                  (PRIORIDADES.find(p => p.value === t.prioridad) ?? PRIORIDADES[1]).color)}>
                  {(PRIORIDADES.find(p => p.value === t.prioridad) ?? PRIORIDADES[1]).label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== AYUDA: cómo funciona ===== */}
      <div className="rounded-lg bg-muted/40 border border-border px-4 py-2.5 text-[12px] text-muted-foreground flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <span>
          <b className="text-foreground">Arrastra las tarjetas</b> con el mouse entre columnas: cuando alguien
          empieza una tarea, la mueves a <b>En progreso</b>; cuando la termina, a <b>Hechas</b>.
          También puedes usar el botón <b>⋯</b> de cada tarjeta.
        </span>
      </div>

      {/* ===== KANBAN — 3 columnas con drag & drop ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {ESTADOS.map(estado => (
          <Columna
            key={estado.value}
            estado={estado}
            tareas={porEstado[estado.value]}
            menuAbiertoId={menuAbierto}
            onAbrirMenu={(id) => setMenuAbierto(id)}
            onToggleHecha={toggleHecha}
            onEditar={abrirEditar}
            onBorrar={(t) => borrar(t.id, t.titulo)}
            onCambiarEstado={cambiarEstado}
            onCrearEnColumna={() => abrirCrear(estado.value)}
            nombreProducto={nombreProducto}
            draggingId={draggingId}
            dragOver={dragOver === estado.value}
            onDragStartCard={(id) => setDraggingId(id)}
            onDragEndCard={() => { setDraggingId(null); setDragOver(null); }}
            onDragOverCol={() => setDragOver(estado.value)}
            onDragLeaveCol={() => setDragOver(d => d === estado.value ? null : d)}
            onDropCol={() => onDropEnColumna(estado.value)}
          />
        ))}
      </div>

      {/* ===== QUÉ LE TOCA A CADA UNO ===== */}
      {porPersona.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Qué le toca a cada uno</h2>
            <span className="text-[11px] text-muted-foreground ml-1">— tareas activas por persona</span>
          </div>
          <div className="p-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {porPersona.map(([persona, ts]) => (
              <div key={persona} className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">
                    {iniciales(persona)}
                  </span>
                  <span className="text-sm font-medium truncate flex-1">{persona}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground tabular-nums">
                    {ts.length}
                  </span>
                </div>
                <ul className="space-y-1">
                  {ts.slice(0, 5).map(t => (
                    <li key={t.id} className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                        t.estado === "en_progreso" ? "bg-amber-500" : "bg-zinc-400")} />
                      <span className="truncate">{t.titulo}</span>
                    </li>
                  ))}
                  {ts.length > 5 && (
                    <li className="text-[11px] text-muted-foreground/70">+{ts.length - 5} más…</li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChipFiltro({ label, count, activo, onClick, color }: {
  label: string; count: number; activo: boolean; onClick: () => void; color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-[11px] px-3 py-1.5 rounded-full border transition inline-flex items-center gap-1.5",
        activo
          ? color ? color + " border-transparent font-medium" : "bg-primary/10 border-primary/30 text-primary font-medium"
          : "bg-card border-border text-muted-foreground hover:border-primary/30",
      )}
    >
      {label} · {count}
    </button>
  );
}

function Columna({ estado, tareas, menuAbiertoId, onAbrirMenu, onToggleHecha, onEditar, onBorrar, onCambiarEstado, onCrearEnColumna, nombreProducto, draggingId, dragOver, onDragStartCard, onDragEndCard, onDragOverCol, onDragLeaveCol, onDropCol }: {
  estado: typeof ESTADOS[number];
  tareas: Tarea[];
  menuAbiertoId: string | null;
  onAbrirMenu: (id: string | null) => void;
  onToggleHecha: (t: Tarea) => void;
  onEditar: (t: Tarea) => void;
  onBorrar: (t: Tarea) => void;
  onCambiarEstado: (id: string, nuevo: Estado) => void;
  onCrearEnColumna: () => void;
  nombreProducto: (id: string | null) => string | null;
  draggingId: string | null;
  dragOver: boolean;
  onDragStartCard: (id: string) => void;
  onDragEndCard: () => void;
  onDragOverCol: () => void;
  onDragLeaveCol: () => void;
  onDropCol: () => void;
}) {
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOverCol(); }}
      onDragLeave={(e) => {
        // Solo quitar highlight si el mouse salió de verdad de la columna
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onDragLeaveCol();
      }}
      onDrop={(e) => { e.preventDefault(); onDropCol(); }}
      className={cn(
        "rounded-xl border p-3 flex flex-col gap-3 min-h-[220px] transition-colors",
        dragOver
          ? cn(estado.border, estado.bg, "border-dashed ring-2 ring-offset-0", estado.border)
          : "border-border bg-muted/20",
      )}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("w-2 h-2 rounded-full", estado.dot)}></span>
            <h2 className="text-sm font-semibold uppercase tracking-wider">{estado.label}</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground tabular-nums">{tareas.length}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{estado.ayuda}</p>
        </div>
        <button
          onClick={onCrearEnColumna}
          className="h-6 w-6 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center shrink-0"
          title={`Nueva tarea en ${estado.label}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 space-y-2">
        {tareas.length === 0 ? (
          <div className={cn(
            "text-center text-xs py-10 border border-dashed rounded-lg transition",
            dragOver ? cn(estado.text, estado.border) : "text-muted-foreground/60 border-border"
          )}>
            {dragOver ? "Suelta aquí ↓" : "Sin tareas · arrastra una aquí"}
          </div>
        ) : (
          tareas.map(t => (
            <CardTarea
              key={t.id}
              t={t}
              arrastrando={draggingId === t.id}
              onDragStart={() => onDragStartCard(t.id)}
              onDragEnd={onDragEndCard}
              menuAbierto={menuAbiertoId === t.id}
              onAbrirMenu={(open) => onAbrirMenu(open ? t.id : null)}
              onToggleHecha={() => onToggleHecha(t)}
              onEditar={() => onEditar(t)}
              onBorrar={() => onBorrar(t)}
              onCambiarEstado={(nuevo) => onCambiarEstado(t.id, nuevo)}
              productoNombre={nombreProducto(t.producto_id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CardTarea({ t, menuAbierto, onAbrirMenu, onToggleHecha, onEditar, onBorrar, onCambiarEstado, productoNombre, arrastrando, onDragStart, onDragEnd }: {
  t: Tarea;
  menuAbierto: boolean;
  onAbrirMenu: (open: boolean) => void;
  onToggleHecha: () => void;
  onEditar: () => void;
  onBorrar: () => void;
  onCambiarEstado: (n: Estado) => void;
  productoNombre: string | null;
  arrastrando: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const prio = PRIORIDADES.find(p => p.value === t.prioridad) ?? PRIORIDADES[1];
  const PrioIcon = prio.icon;
  const dias = diasHasta(t.fecha_limite);
  const esHecha = t.estado === "hecha";

  // Color de fecha según urgencia
  const fechaColor =
    dias === null ? "text-muted-foreground" :
    dias < 0 ? "text-rose-600 dark:text-rose-400" :
    dias <= 1 ? "text-amber-600 dark:text-amber-400" :
    "text-muted-foreground";

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      className={cn(
        "group rounded-lg border border-border bg-card p-3 transition-all hover:shadow-md hover:border-primary/30 cursor-grab active:cursor-grabbing",
        esHecha && "opacity-60",
        arrastrando && "opacity-40 ring-2 ring-primary scale-[0.98]"
      )}>
      <div className="flex items-start gap-2.5">
        {/* Checkbox */}
        <button
          onClick={onToggleHecha}
          className={cn(
            "shrink-0 mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center transition",
            esHecha
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "border-border hover:border-primary"
          )}
          title={esHecha ? "Marcar como pendiente" : "Marcar como hecha"}
        >
          {esHecha && <CheckCircle2 className="h-3 w-3 fill-current" />}
        </button>

        {/* Contenido */}
        <div className="min-w-0 flex-1">
          <h3 className={cn(
            "font-medium text-sm leading-tight",
            esHecha && "line-through text-muted-foreground"
          )}>
            {t.titulo}
          </h3>
          {t.descripcion && (
            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{t.descripcion}</p>
          )}

          {/* Meta: asignado, fecha, producto */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {/* Prioridad */}
            <span className={cn("inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded", prio.color)}>
              {PrioIcon && <PrioIcon className="h-2.5 w-2.5" />}
              {prio.label}
            </span>

            {/* Asignado */}
            {t.asignado && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="w-4 h-4 rounded-full bg-primary/15 text-primary text-[8px] font-bold flex items-center justify-center">
                  {iniciales(t.asignado)}
                </span>
                {t.asignado}
              </span>
            )}

            {/* Fecha límite */}
            {t.fecha_limite && (
              <span className={cn("inline-flex items-center gap-1 text-[11px]", fechaColor)}>
                <Calendar className="h-3 w-3" />
                {formatFecha(t.fecha_limite)}
              </span>
            )}

            {/* Producto vinculado */}
            {productoNombre && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                <Package className="h-3 w-3" />
                <span className="truncate max-w-[120px]">{productoNombre}</span>
              </span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEditar}
            title="Editar"
            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onBorrar}
            title="Borrar"
            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <div className="relative" onClick={(ev) => ev.stopPropagation()}>
            <button
              onClick={() => onAbrirMenu(!menuAbierto)}
              className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Mover a…"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {menuAbierto && (
              <div className="absolute right-0 top-8 z-30 w-44 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card shadow-xl overflow-hidden">
                <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground border-b border-border/50">
                  Mover a…
                </div>
                {ESTADOS.map(es => (
                  <button
                    key={es.value}
                    onClick={() => onCambiarEstado(es.value)}
                    disabled={es.value === t.estado}
                    className="w-full px-3 py-1.5 text-left text-sm flex items-center gap-2 hover:bg-muted transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full", es.dot)}></span>
                    <span className={cn(es.value === t.estado && "font-semibold")}>{es.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
