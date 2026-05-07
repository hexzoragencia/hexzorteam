"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { TAREA_TIPOS, type Tarea, type TareaTipo, type Espacio } from "@/lib/types";
import { diasDeSemana, fechaCorta, formatHora, hoyIso, sumarDias } from "@/lib/fechas";
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, Check, X, CalendarDays, Clock, CheckCircle2 } from "lucide-react";

const HORA_INICIO = 5;   // 05:00 AM
const HORA_FIN = 24;     // 12:00 AM (medianoche; último slot 23:30)
const SLOT_MIN = 30;     // duración de cada slot
const SLOTS_POR_HORA = 60 / SLOT_MIN;
const TOTAL_SLOTS = (HORA_FIN - HORA_INICIO) * SLOTS_POR_HORA;
const SLOT_HEIGHT = 32; // px por slot de 30min

function slotToHora(slot: number): string {
  const minutos = slot * SLOT_MIN + HORA_INICIO * 60;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function horaToSlot(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return (h - HORA_INICIO) * SLOTS_POR_HORA + Math.floor(m / SLOT_MIN);
}

type Form = {
  titulo: string; descripcion: string; tipo: TareaTipo;
  fecha: string; hora_inicio: string; duracion_min: number;
  notas: string;
};

export function PlaneacionClient({
  espacio, semanaInicio, vistaInicial, initial,
}: { espacio: Espacio; semanaInicio: string; vistaInicial: "dia" | "semana" | "mes"; initial: Tarea[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const supabase = createClient();
  const [tareas, setTareas] = useState<Tarea[]>(initial);
  const [vista, setVistaState] = useState<"dia" | "semana" | "mes">(vistaInicial);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string>(hoyIso());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);

  const dias = diasDeSemana(semanaInicio);
  const tareasIdx = useMemo(() => {
    const m: Record<string, Tarea[]> = {};
    for (const t of tareas) (m[t.fecha] ??= []).push(t);
    return m;
  }, [tareas]);

  function navegar(nuevoLunes: string, nuevaVista?: "dia" | "semana" | "mes") {
    const params = new URLSearchParams(sp.toString());
    params.set("semana", nuevoLunes);
    if (nuevaVista) params.set("vista", nuevaVista);
    router.push(`${pathname}?${params.toString()}`);
  }
  function setVista(v: "dia" | "semana" | "mes") {
    setVistaState(v);
    const params = new URLSearchParams(sp.toString());
    params.set("vista", v);
    router.push(`${pathname}?${params.toString()}`);
  }

  function abrirCrear(fecha: string, slot?: number) {
    const hora = slot !== undefined ? slotToHora(slot).slice(0, 5) : "";
    setForm({
      titulo: "", descripcion: "", tipo: "tarea",
      fecha, hora_inicio: hora, duracion_min: 60, notas: "",
    });
    setEditingId(null);
    setShowForm(true);
  }
  function abrirEditar(t: Tarea) {
    setForm({
      titulo: t.titulo, descripcion: t.descripcion ?? "", tipo: t.tipo,
      fecha: t.fecha, hora_inicio: t.hora_inicio?.slice(0, 5) ?? "",
      duracion_min: t.duracion_min, notas: t.notas ?? "",
    });
    setEditingId(t.id);
    setShowForm(true);
  }
  function cancelar() { setShowForm(false); setEditingId(null); setForm(null); }

  async function guardar() {
    if (!form) return;
    const titulo = form.titulo.trim();
    if (!titulo) { alert("Falta el título"); return; }
    const payload: any = {
      espacio_id: espacio.id, titulo,
      descripcion: form.descripcion.trim() || null,
      tipo: form.tipo, fecha: form.fecha,
      hora_inicio: form.hora_inicio ? `${form.hora_inicio}:00` : null,
      duracion_min: form.duracion_min,
      notas: form.notas.trim() || null,
    };
    if (editingId) {
      const { data, error } = await supabase.from("tareas").update(payload).eq("id", editingId).select().single();
      if (error) { alert(error.message); return; }
      setTareas(tareas.map(t => t.id === editingId ? (data as Tarea) : t));
    } else {
      const { data, error } = await supabase.from("tareas").insert(payload).select().single();
      if (error) { alert(error.message); return; }
      setTareas([...tareas, data as Tarea]);
    }
    cancelar();
    router.refresh();
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar esta tarea?")) return;
    const { error } = await supabase.from("tareas").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setTareas(tareas.filter(t => t.id !== id));
    router.refresh();
  }

  async function toggleCompletada(t: Tarea) {
    const update: any = { completada: !t.completada, completada_at: !t.completada ? new Date().toISOString() : null };
    const { data, error } = await supabase.from("tareas").update(update).eq("id", t.id).select().single();
    if (error) { alert(error.message); return; }
    setTareas(tareas.map(x => x.id === t.id ? (data as Tarea) : x));
    router.refresh();
  }

  const hoy = hoyIso();

  return (
    <div className="space-y-4">
      {/* Header con navegación de semana */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><CalendarDays className="h-7 w-7 text-primary" /> Planeación diaria</h1>
          <p className="text-muted-foreground text-sm">Click en cualquier hora para crear un bloque. Chulea cuando termines.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 rounded-md border bg-card p-0.5">
            <Button variant={vista === "semana" ? "default" : "ghost"} size="sm" onClick={() => setVista("semana")} className="h-7">Semana</Button>
            <Button variant={vista === "dia" ? "default" : "ghost"} size="sm" onClick={() => setVista("dia")} className="h-7">Día</Button>
            <Button variant={vista === "mes" ? "default" : "ghost"} size="sm" onClick={() => setVista("mes")} className="h-7">Mes</Button>
          </div>
          <Button variant="outline" size="icon" onClick={() => navegar(sumarDias(semanaInicio, -7))} className="h-9 w-9"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => navegar(hoyIso())} className="h-9">Hoy</Button>
          <Button variant="outline" size="icon" onClick={() => navegar(sumarDias(semanaInicio, 7))} className="h-9 w-9"><ChevronRight className="h-4 w-4" /></Button>
          <Button onClick={() => abrirCrear(diaSeleccionado)}><Plus className="h-4 w-4 mr-1" /> Tarea</Button>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        Semana del {fechaCorta(dias[0]).numero} {fechaCorta(dias[0]).mes} al {fechaCorta(dias[6]).numero} {fechaCorta(dias[6]).mes}
      </div>

      {/* Formulario */}
      {showForm && form && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Título</label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ej. Reunión con Miguel" autoFocus />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tipo</label>
                <select className="h-11 w-full rounded-md border border-input bg-background px-3" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as TareaTipo })}>
                  {TAREA_TIPOS.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Fecha</label>
                <Input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Hora (opcional)</label>
                <Input type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Duración: {form.duracion_min}min</label>
                <input type="range" min="15" max="480" step="15" value={form.duracion_min} onChange={(e) => setForm({ ...form, duracion_min: Number(e.target.value) })} className="w-full" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Descripción / Notas (opcional)</label>
                <Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={2} />
              </div>
            </div>
            <div className="flex gap-2 pt-1 flex-wrap">
              <Button onClick={guardar}><Check className="h-4 w-4 mr-1" /> Guardar</Button>
              <Button variant="outline" onClick={cancelar}>Cancelar</Button>
              {editingId && (
                <Button
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive ml-auto"
                  onClick={async () => { await borrar(editingId); cancelar(); }}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Eliminar tarea
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {vista === "semana" ? (
        // ============ VISTA SEMANAL ============
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <div className="grid border-b" style={{ gridTemplateColumns: "60px repeat(7, minmax(120px, 1fr))" }}>
              <div className="px-2 py-2 text-xs text-muted-foreground"></div>
              {dias.map(d => {
                const f = fechaCorta(d);
                const esHoy = d === hoy;
                return (
                  <div key={d} className={cn("text-center py-2 border-l", esHoy && "bg-primary/10")}>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{f.dia}</div>
                    <div className={cn("text-lg font-semibold", esHoy && "text-primary")}>{f.numero}</div>
                  </div>
                );
              })}
            </div>
            <div className="grid relative" style={{ gridTemplateColumns: "60px repeat(7, minmax(120px, 1fr))" }}>
              {/* Columna de horas */}
              <div className="border-r">
                {Array.from({ length: HORA_FIN - HORA_INICIO }).map((_, i) => (
                  <div key={i} className="text-[10px] text-muted-foreground text-right pr-2" style={{ height: SLOT_HEIGHT * SLOTS_POR_HORA }}>
                    <span className="-translate-y-1.5 inline-block">{`${(HORA_INICIO + i) % 12 === 0 ? 12 : (HORA_INICIO + i) % 12}${HORA_INICIO + i >= 12 ? "pm" : "am"}`}</span>
                  </div>
                ))}
              </div>
              {/* Columnas de días */}
              {dias.map(dia => (
                <DayColumn
                  key={dia}
                  fecha={dia}
                  tareas={tareasIdx[dia] ?? []}
                  esHoy={dia === hoy}
                  onCrearEnSlot={(slot) => abrirCrear(dia, slot)}
                  onEditar={abrirEditar}
                  onToggle={toggleCompletada}
                  onBorrar={borrar}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : vista === "dia" ? (
        // ============ VISTA DIARIA ============
        <DayView
          dias={dias}
          diaSeleccionado={diaSeleccionado}
          setDiaSeleccionado={setDiaSeleccionado}
          tareasIdx={tareasIdx}
          hoy={hoy}
          onCrear={(f, s) => abrirCrear(f, s)}
          onEditar={abrirEditar}
          onToggle={toggleCompletada}
          onBorrar={borrar}
        />
      ) : (
        // ============ VISTA MENSUAL ============
        <MesView
          tareas={tareas}
          hoy={hoy}
          onSeleccionarDia={(fecha) => { setDiaSeleccionado(fecha); setVista("dia"); }}
        />
      )}
    </div>
  );
}

// Columna de un día en la vista semanal
function DayColumn({
  fecha, tareas, esHoy, onCrearEnSlot, onEditar, onToggle, onBorrar,
}: {
  fecha: string; tareas: Tarea[]; esHoy: boolean;
  onCrearEnSlot: (slot: number) => void;
  onEditar: (t: Tarea) => void;
  onToggle: (t: Tarea) => void;
  onBorrar: (id: string) => void;
}) {
  // Tareas con hora se ubican absolutamente en la columna
  const conHora = tareas.filter(t => t.hora_inicio);
  const sinHora = tareas.filter(t => !t.hora_inicio);

  const totalHeight = TOTAL_SLOTS * SLOT_HEIGHT;

  return (
    <div className={cn("border-l relative", esHoy && "bg-primary/[0.03]")} style={{ height: totalHeight }}>
      {/* Líneas de hora (cada hora) */}
      {Array.from({ length: HORA_FIN - HORA_INICIO }).map((_, i) => (
        <div key={i} className="absolute inset-x-0 border-t border-border/40" style={{ top: i * SLOT_HEIGHT * SLOTS_POR_HORA }} />
      ))}
      {/* Slots clickeables */}
      {Array.from({ length: TOTAL_SLOTS }).map((_, slot) => (
        <button
          key={slot}
          onClick={() => onCrearEnSlot(slot)}
          className="absolute inset-x-0 hover:bg-primary/10 transition-colors"
          style={{ top: slot * SLOT_HEIGHT, height: SLOT_HEIGHT }}
          title={`+ ${slotToHora(slot).slice(0, 5)}`}
        />
      ))}
      {/* Bloques con hora */}
      {conHora.map(t => {
        const slot = horaToSlot(t.hora_inicio!);
        const altura = (t.duracion_min / SLOT_MIN) * SLOT_HEIGHT - 2;
        const tipoInfo = TAREA_TIPOS.find(x => x.value === t.tipo)!;
        return (
          <div
            key={t.id}
            className={cn(
              "absolute inset-x-0.5 rounded border px-1.5 py-1 text-[11px] overflow-hidden cursor-pointer group hover:shadow-md transition-shadow",
              t.completada
                ? "!bg-success/25 !border-success !text-success"
                : cn(tipoInfo.bg, tipoInfo.border, tipoInfo.text)
            )}
            style={{ top: slot * SLOT_HEIGHT + 1, height: altura, minHeight: 24 }}
            onClick={() => onEditar(t)}
          >
            <div className="flex items-start justify-between gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); onToggle(t); }}
                className={cn("h-3.5 w-3.5 rounded border shrink-0 mt-0.5 flex items-center justify-center", t.completada ? "bg-success border-success" : "bg-background/50 border-current")}
              >
                {t.completada && <Check className="h-2.5 w-2.5 text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={cn("font-semibold truncate text-[11px] leading-tight", t.completada && "line-through")}>{t.titulo}</p>
                {altura > 30 && <p className="text-[10px] opacity-70">{formatHora(t.hora_inicio)}</p>}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onBorrar(t.id); }}
                className="shrink-0 h-3.5 w-3.5 rounded hover:bg-black/20 flex items-center justify-center opacity-60 hover:opacity-100"
                title="Eliminar"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          </div>
        );
      })}
      {/* Tareas sin hora (en la parte superior, modo etiqueta) */}
      {sinHora.length > 0 && (
        <div className="absolute top-0 inset-x-1 space-y-0.5 z-10">
          {sinHora.map(t => {
            const tipoInfo = TAREA_TIPOS.find(x => x.value === t.tipo)!;
            return (
              <div key={t.id} className={cn("rounded border px-1.5 py-0.5 text-[10px] flex items-center gap-1 cursor-pointer", tipoInfo.bg, tipoInfo.border, tipoInfo.text)} onClick={() => onEditar(t)}>
                <button onClick={(e) => { e.stopPropagation(); onToggle(t); }} className={cn("h-3 w-3 rounded border shrink-0", t.completada ? "bg-success border-success" : "border-current")}>
                  {t.completada && <Check className="h-2 w-2 text-white" />}
                </button>
                <span className={cn("truncate flex-1", t.completada && "line-through")}>{t.titulo}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onBorrar(t.id); }}
                  className="shrink-0 h-3 w-3 rounded hover:bg-black/20 flex items-center justify-center opacity-60 hover:opacity-100"
                  title="Eliminar"
                >
                  <X className="h-2 w-2" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Vista DIARIA: lista vertical más cómoda en celular
function DayView({
  dias, diaSeleccionado, setDiaSeleccionado, tareasIdx, hoy,
  onCrear, onEditar, onToggle, onBorrar,
}: {
  dias: string[]; diaSeleccionado: string; setDiaSeleccionado: (d: string) => void;
  tareasIdx: Record<string, Tarea[]>; hoy: string;
  onCrear: (fecha: string, slot?: number) => void;
  onEditar: (t: Tarea) => void;
  onToggle: (t: Tarea) => void;
  onBorrar: (id: string) => void;
}) {
  const tareasDia = (tareasIdx[diaSeleccionado] ?? []).slice().sort((a, b) => {
    if (!a.hora_inicio) return -1;
    if (!b.hora_inicio) return 1;
    return a.hora_inicio.localeCompare(b.hora_inicio);
  });

  return (
    <>
      {/* Selector de día */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {dias.map(d => {
          const f = fechaCorta(d);
          const isSel = d === diaSeleccionado;
          const esHoy = d === hoy;
          return (
            <button
              key={d}
              onClick={() => setDiaSeleccionado(d)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm shrink-0 transition-colors min-w-[60px]",
                isSel ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:border-primary/40",
                !isSel && esHoy && "border-primary/50"
              )}
            >
              <div className="text-[10px] uppercase opacity-70">{f.dia}</div>
              <div className="text-lg font-bold">{f.numero}</div>
            </button>
          );
        })}
      </div>
      {/* Lista del día */}
      <Card>
        <CardContent className="p-3 space-y-2">
          {tareasDia.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Día libre. Click abajo para agregar.</p>
              <Button onClick={() => onCrear(diaSeleccionado)} className="mt-3"><Plus className="h-4 w-4 mr-1" /> Agregar tarea</Button>
            </div>
          ) : (
            tareasDia.map(t => {
              const tipoInfo = TAREA_TIPOS.find(x => x.value === t.tipo)!;
              return (
                <div key={t.id} className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 group",
                  t.completada
                    ? "!bg-success/15 !border-success/50"
                    : cn(tipoInfo.bg, tipoInfo.border)
                )}>
                  <button
                    onClick={() => onToggle(t)}
                    className={cn("h-5 w-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center", t.completada ? "bg-success border-success" : "border-current bg-background/50")}
                  >
                    {t.completada && <Check className="h-3 w-3 text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-semibold leading-tight", t.completada && "line-through", tipoInfo.text)}>{tipoInfo.emoji} {t.titulo}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      {t.hora_inicio && <span>{formatHora(t.hora_inicio)} · {t.duracion_min}min</span>}
                      {!t.hora_inicio && <span>Sin hora</span>}
                    </div>
                    {t.descripcion && <p className="text-xs text-muted-foreground mt-1">{t.descripcion}</p>}
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => onEditar(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onBorrar(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              );
            })
          )}
          {tareasDia.length > 0 && (
            <Button variant="outline" className="w-full" onClick={() => onCrear(diaSeleccionado)}><Plus className="h-4 w-4 mr-1" /> Agregar otra</Button>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ============ VISTA MENSUAL — vista calendario tipo grid ============
function MesView({ tareas, hoy, onSeleccionarDia }: {
  tareas: Tarea[]; hoy: string;
  onSeleccionarDia: (fecha: string) => void;
}) {
  // 3 meses visibles: anterior, actual, siguiente. Default: actual.
  const [offsetMes, setOffsetMes] = useState(0); // 0 = mes actual, -1 = anterior, etc.

  const hoyD = new Date(hoy + "T00:00:00");
  const mesBase = new Date(hoyD.getFullYear(), hoyD.getMonth() + offsetMes, 1);
  const ano = mesBase.getFullYear();
  const mesNum = mesBase.getMonth();
  const primerDia = new Date(ano, mesNum, 1);
  const ultimoDia = new Date(ano, mesNum + 1, 0);
  // Día de semana del primer día (0=Dom, 1=Lun...). Lo ajusto para que Lun sea 0.
  const dowPrimero = (primerDia.getDay() + 6) % 7;

  // Index tareas por fecha
  const idxFecha: Record<string, Tarea[]> = {};
  for (const t of tareas) (idxFecha[t.fecha] ??= []).push(t);

  // Construyo grid de 6x7 (algunas semanas tendrán días del mes anterior/siguiente)
  const celdas: { fecha: string; dia: number; esDelMes: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const offsetDia = i - dowPrimero;
    const d = new Date(ano, mesNum, 1 + offsetDia);
    celdas.push({
      fecha: d.toISOString().slice(0, 10),
      dia: d.getDate(),
      esDelMes: d.getMonth() === mesNum,
    });
  }

  const MES_LARGOS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const DIAS_CORTOS = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

  return (
    <Card>
      <CardContent className="p-3 sm:p-4 space-y-3">
        {/* Header con navegación de mes */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" onClick={() => setOffsetMes(o => o - 1)} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <div className="font-semibold">{MES_LARGOS[mesNum]} {ano}</div>
            {offsetMes !== 0 && (
              <button onClick={() => setOffsetMes(0)} className="text-xs text-primary hover:underline">Volver al mes actual</button>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={() => setOffsetMes(o => o + 1)} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Encabezados de días */}
        <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
          {DIAS_CORTOS.map(d => <div key={d} className="text-center py-1">{d}</div>)}
        </div>

        {/* Celdas */}
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((c, i) => {
            const tDia = idxFecha[c.fecha] ?? [];
            const total = tDia.length;
            const completas = tDia.filter(t => t.completada).length;
            const pct = total > 0 ? completas / total : 0;
            const todasOK = total > 0 && completas === total;
            const esHoy = c.fecha === hoy;

            return (
              <button
                key={i}
                onClick={() => c.esDelMes && onSeleccionarDia(c.fecha)}
                className={cn(
                  "relative aspect-square rounded-md border p-1 text-left transition",
                  !c.esDelMes && "opacity-30 cursor-default",
                  c.esDelMes && "hover:border-primary cursor-pointer",
                  esHoy && "border-primary border-2",
                  todasOK && c.esDelMes && "bg-success/15 border-success",
                  !todasOK && total > 0 && c.esDelMes && "bg-primary/5",
                )}
                disabled={!c.esDelMes}
              >
                <div className={cn("text-xs font-semibold", esHoy && "text-primary", todasOK && "text-success")}>
                  {c.dia}
                </div>
                {total > 0 && c.esDelMes && (
                  <div className="absolute bottom-1 left-1 right-1">
                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full transition-all", todasOK ? "bg-success" : "bg-primary")} style={{ width: `${pct * 100}%` }} />
                    </div>
                    <div className="text-[8px] text-muted-foreground tabular-nums mt-0.5">{completas}/{total}</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground pt-1">
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-success/30 border border-success" /> Día completado</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-primary/10 border border-border" /> Con tareas pendientes</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded border-2 border-primary" /> Hoy</span>
          <span className="ml-auto">Click en un día para ver detalle.</span>
        </div>
      </CardContent>
    </Card>
  );
}
