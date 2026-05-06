"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Habito, HabitoMarca, Espacio } from "@/lib/types";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { LineHabitosAnual, BarHabitos, HeatmapAnual } from "@/components/dashboard/habitos-charts";
import { Plus, Trash2, Pencil, Check, X, Flame, Trophy, TrendingDown, Target, CheckCheck, Sparkles } from "lucide-react";

const MES_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DIA_LETRA = ["D","L","M","M","J","V","S"]; // domingo=0

export function HabitosClient({
  espacio, ano, mes, initialHabitos, initialMarcas,
}: {
  espacio: Espacio; ano: number; mes: number;
  initialHabitos: Habito[]; initialMarcas: HabitoMarca[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [habitos, setHabitos] = useState<Habito[]>(initialHabitos);
  const [marcas, setMarcas] = useState<HabitoMarca[]>(initialMarcas);
  const [showForm, setShowForm] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoHoraDesde, setNuevoHoraDesde] = useState("");
  const [nuevoHoraHasta, setNuevoHoraHasta] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [, startTransition] = useTransition();

  const diasEnMes = new Date(ano, mes, 0).getDate();
  const dias = Array.from({ length: diasEnMes }, (_, i) => i + 1);
  const hoy = new Date();
  const esEsteMes = hoy.getFullYear() === ano && hoy.getMonth() + 1 === mes;
  const diaHoy = esEsteMes ? hoy.getDate() : -1;

  // Index marcas por habito_id + fecha para O(1) lookup
  const marcasIdx = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const m of marcas) {
      if (!map[m.habito_id]) map[m.habito_id] = new Set();
      map[m.habito_id].add(m.fecha);
    }
    return map;
  }, [marcas]);

  function isMarcado(habitoId: string, fecha: string) {
    return marcasIdx[habitoId]?.has(fecha) ?? false;
  }

  function fechaDe(dia: number) {
    return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }

  // Toggle marca con optimistic update
  async function toggleMarca(habitoId: string, dia: number) {
    const fecha = fechaDe(dia);
    const ya = isMarcado(habitoId, fecha);

    // Optimistic UI
    if (ya) {
      setMarcas(m => m.filter(x => !(x.habito_id === habitoId && x.fecha === fecha)));
    } else {
      setMarcas(m => [...m, { habito_id: habitoId, fecha }]);
    }

    if (ya) {
      const { error } = await supabase.from("habito_marcas").delete().eq("habito_id", habitoId).eq("fecha", fecha);
      if (error) {
        // revertir
        setMarcas(m => [...m, { habito_id: habitoId, fecha }]);
        alert(error.message);
      }
    } else {
      const { error } = await supabase.from("habito_marcas").insert({ habito_id: habitoId, fecha });
      if (error) {
        setMarcas(m => m.filter(x => !(x.habito_id === habitoId && x.fecha === fecha)));
        alert(error.message);
      }
    }
    startTransition(() => router.refresh());
  }

  async function agregarHabito() {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    const payload: any = {
      espacio_id: espacio.id, nombre, orden: habitos.length,
      hora_desde: nuevoHoraDesde || null,
      hora_hasta: nuevoHoraHasta || null,
    };
    const { data, error } = await supabase.from("habitos").insert(payload).select().single();
    if (error) { alert(error.message); return; }
    setHabitos([...habitos, data as Habito]);
    setNuevoNombre(""); setNuevoHoraDesde(""); setNuevoHoraHasta("");
    setShowForm(false);
    router.refresh();
  }

  async function guardarEdit(id: string) {
    const nombre = editValue.trim();
    if (!nombre) return;
    const { error } = await supabase.from("habitos").update({ nombre }).eq("id", id);
    if (error) { alert(error.message); return; }
    setHabitos(habitos.map(h => h.id === id ? { ...h, nombre } : h));
    setEditingId(null);
    router.refresh();
  }

  async function archivar(id: string) {
    if (!confirm("¿Archivar este hábito? El histórico se conserva.")) return;
    const { error } = await supabase.from("habitos").update({ archivado: true }).eq("id", id);
    if (error) { alert(error.message); return; }
    setHabitos(habitos.filter(h => h.id !== id));
    router.refresh();
  }

  // ========= MÉTRICAS =========
  const inicioMes = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const finMes = `${ano}-${String(mes).padStart(2, "0")}-${String(diasEnMes).padStart(2, "0")}`;
  const marcasEsteMes = marcas.filter(m => m.fecha >= inicioMes && m.fecha <= finMes);
  const totalEsperado = habitos.length * diasEnMes; // simplificado: cada hábito todos los días
  const totalReal = marcasEsteMes.length;
  const pctGlobalMes = totalEsperado > 0 ? (totalReal / totalEsperado) * 100 : 0;

  // % por hábito este mes
  const porHabito = habitos.map(h => {
    const count = marcasEsteMes.filter(m => m.habito_id === h.id).length;
    return { habito: h, count, pct: diasEnMes > 0 ? (count / diasEnMes) * 100 : 0 };
  });
  const masCumplido = [...porHabito].sort((a, b) => b.pct - a.pct)[0];
  const menosCumplido = [...porHabito].sort((a, b) => a.pct - b.pct)[0];

  // Racha actual: días consecutivos hacia atrás (contando desde hoy o último día del mes) donde TODOS los hábitos se cumplieron
  function rachaActual() {
    if (habitos.length === 0) return 0;
    const hoyDate = new Date();
    let cursor = new Date(hoyDate);
    cursor.setHours(0, 0, 0, 0);
    let racha = 0;
    while (racha < 365) {
      const iso = cursor.toISOString().slice(0, 10);
      const todasMarcadas = habitos.every(h => marcasIdx[h.id]?.has(iso));
      if (!todasMarcadas) break;
      racha++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return racha;
  }
  const racha = rachaActual();

  // Mejor racha del año (recorre el año entero)
  function mejorRacha() {
    if (habitos.length === 0) return 0;
    let mejor = 0, actual = 0;
    const start = new Date(Date.UTC(ano, 0, 1));
    const end = new Date(Date.UTC(ano + 1, 0, 1));
    for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
      const iso = d.toISOString().slice(0, 10);
      const todas = habitos.every(h => marcasIdx[h.id]?.has(iso));
      if (todas) { actual++; mejor = Math.max(mejor, actual); }
      else actual = 0;
    }
    return mejor;
  }
  const rachaMaxAno = mejorRacha();

  // Línea anual: % por mes
  const anualData = MES_NAMES.map((nm, idx) => {
    const m = idx + 1;
    const dEnEseMes = new Date(ano, m, 0).getDate();
    const ini = `${ano}-${String(m).padStart(2, "0")}-01`;
    const fin = `${ano}-${String(m).padStart(2, "0")}-${String(dEnEseMes).padStart(2, "0")}`;
    const marcasMes = marcas.filter(x => x.fecha >= ini && x.fecha <= fin).length;
    const esperado = habitos.length * dEnEseMes;
    return { mes: nm, pct: esperado > 0 ? (marcasMes / esperado) * 100 : 0 };
  });

  // Heatmap: count de hábitos cumplidos por fecha del año
  const heatmapData = useMemo(() => {
    const m: Record<string, number> = {};
    for (const x of marcas) m[x.fecha] = (m[x.fecha] ?? 0) + 1;
    return m;
  }, [marcas]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Sparkles className="h-7 w-7 text-primary" /> Hábitos</h1>
          <p className="text-muted-foreground">Marca cada día. La constancia es lo que cambia tu vida.</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthSelector ano={ano} mes={mes} />
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" /> {showForm ? "Cerrar" : "Nuevo hábito"}
          </Button>
        </div>
      </div>

      {/* Form rápido para agregar hábito */}
      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <Input
              placeholder="Ej. Ejercicio matutino"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground">Hora desde (opcional)</label>
                <Input
                  type="time"
                  value={nuevoHoraDesde}
                  onChange={(e) => setNuevoHoraDesde(e.target.value)}
                  placeholder="06:00"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Hora hasta (opcional)</label>
                <Input
                  type="time"
                  value={nuevoHoraHasta}
                  onChange={(e) => setNuevoHoraHasta(e.target.value)}
                  placeholder="08:00"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">El rango es opcional. Si lo defines, sabrás exactamente cuándo te toca este hábito.</p>
            <div className="flex gap-2">
              <Button onClick={agregarHabito}><Check className="h-4 w-4 mr-1" /> Crear hábito</Button>
              <Button variant="outline" onClick={() => { setShowForm(false); setNuevoNombre(""); setNuevoHoraDesde(""); setNuevoHoraHasta(""); }}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiBox
          title={`Cumplimiento ${MES_NAMES[mes - 1]}`}
          value={`${pctGlobalMes.toFixed(0)}%`}
          subtitle={`${totalReal} de ${totalEsperado} marcas`}
          icon={<Target />}
          color="text-primary"
          progress={pctGlobalMes}
        />
        <KpiBox
          title="Racha actual"
          value={racha === 0 ? "—" : `${racha} día${racha !== 1 ? "s" : ""}`}
          subtitle={racha > 0 ? "Todos los hábitos cumplidos" : "Empieza hoy"}
          icon={<Flame />}
          color={racha > 0 ? "text-orange-500" : "text-muted-foreground"}
        />
        <KpiBox
          title="Mejor racha del año"
          value={rachaMaxAno === 0 ? "—" : `${rachaMaxAno} días`}
          subtitle={`Récord en ${ano}`}
          icon={<Trophy />}
          color="text-yellow-600"
        />
        <KpiBox
          title="Hábito estrella"
          value={masCumplido && masCumplido.count > 0 ? masCumplido.habito.nombre.slice(0, 20) : "—"}
          subtitle={masCumplido && masCumplido.count > 0 ? `${masCumplido.pct.toFixed(0)}% del mes` : "Sin marcas aún"}
          icon={<CheckCheck />}
          color="text-success"
        />
      </div>

      {habitos.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center space-y-3 py-12">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aún no tienes hábitos. Empieza con uno (o varios).</p>
            <Button onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-1" /> Crear primer hábito</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* GRILLA MENSUAL TIPO EXCEL */}
          <Card>
            <CardHeader>
              <CardTitle>{MES_NAMES[mes - 1]} {ano} · click para marcar/desmarcar</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="border-collapse text-sm w-full">
                <thead>
                  <tr className="bg-muted/40">
                    <th className="sticky left-0 bg-muted/40 text-left px-3 py-2 z-10 min-w-[180px] border-r">Hábito</th>
                    {dias.map(d => {
                      const fecha = new Date(ano, mes - 1, d);
                      const dow = fecha.getDay();
                      const esHoy = d === diaHoy;
                      const esFinde = dow === 0 || dow === 6;
                      return (
                        <th key={d} className={cn(
                          "text-center font-medium px-1 py-2 text-[10px] tabular-nums w-7",
                          esHoy && "bg-primary text-primary-foreground rounded",
                          esFinde && !esHoy && "text-muted-foreground"
                        )}>
                          <div>{DIA_LETRA[dow]}</div>
                          <div>{d}</div>
                        </th>
                      );
                    })}
                    <th className="text-center font-medium px-2 py-2 text-xs border-l">%</th>
                  </tr>
                </thead>
                <tbody>
                  {porHabito.map(({ habito: h, count, pct }) => (
                    <tr key={h.id} className="border-t hover:bg-muted/20">
                      <td className="sticky left-0 bg-card hover:bg-muted/20 border-r px-3 py-1.5 z-10 min-w-[180px]">
                        {editingId === h.id ? (
                          <div className="flex gap-1">
                            <Input className="h-7" value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus onKeyDown={(e) => e.key === "Enter" && guardarEdit(h.id)} />
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => guardarEdit(h.id)}><Check className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2 group">
                            <div className="min-w-0 flex-1">
                              <span className="font-medium text-sm truncate block">{h.nombre}</span>
                              {(h.hora_desde || h.hora_hasta) && (
                                <span className="text-[10px] text-muted-foreground tabular-nums">
                                  {h.hora_desde?.slice(0, 5) || "?"} – {h.hora_hasta?.slice(0, 5) || "?"}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-0.5 shrink-0">
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => { setEditingId(h.id); setEditValue(h.nombre); }}><Pencil className="h-3 w-3" /></Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => archivar(h.id)}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </div>
                        )}
                      </td>
                      {dias.map(d => {
                        const marcado = isMarcado(h.id, fechaDe(d));
                        const esHoy = d === diaHoy;
                        return (
                          <td key={d} className="p-0">
                            <button
                              onClick={() => toggleMarca(h.id, d)}
                              className={cn(
                                "w-7 h-7 flex items-center justify-center transition-colors",
                                marcado ? "bg-primary text-primary-foreground" : "hover:bg-primary/10",
                                esHoy && !marcado && "ring-1 ring-primary"
                              )}
                              title={fechaDe(d)}
                            >
                              {marcado ? "✓" : ""}
                            </button>
                          </td>
                        );
                      })}
                      <td className={cn("text-center font-semibold border-l px-2 tabular-nums text-xs", pct >= 80 ? "text-success" : pct >= 50 ? "text-orange-500" : "text-muted-foreground")}>
                        {pct.toFixed(0)}%
                        <div className="text-[10px] text-muted-foreground font-normal">{count}/{diasEnMes}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Cumplimiento por hábito · {MES_NAMES[mes - 1]}</CardTitle></CardHeader>
              <CardContent>
                <BarHabitos data={porHabito.map(h => ({ nombre: h.habito.nombre, pct: h.pct }))} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Evolución mes a mes · {ano}</CardTitle></CardHeader>
              <CardContent>
                <LineHabitosAnual data={anualData} />
              </CardContent>
            </Card>
          </div>

          {/* Heatmap anual */}
          <Card>
            <CardHeader>
              <CardTitle>Año completo · {ano}</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Cada cuadrito es un día. Más oscuro = más hábitos cumplidos ese día.</p>
            </CardHeader>
            <CardContent>
              <HeatmapAnual ano={ano} fechasCount={heatmapData} />
            </CardContent>
          </Card>

          {/* Hábito menos cumplido — alerta */}
          {menosCumplido && menosCumplido.pct < 30 && menosCumplido !== masCumplido && (
            <div className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 p-4 text-sm">
              <TrendingDown className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Hábito que está atrás: <span className="font-bold">{menosCumplido.habito.nombre}</span></p>
                <p className="text-muted-foreground mt-1">Solo {menosCumplido.pct.toFixed(0)}% del mes ({menosCumplido.count} de {diasEnMes} días). Considera ajustarlo o priorizarlo.</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function KpiBox({ title, value, subtitle, icon, color, progress }: {
  title: string; value: string; subtitle?: string; icon: React.ReactNode; color: string; progress?: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("h-4 w-4", color)}>{icon}</div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className={cn("text-2xl font-bold tabular-nums truncate", color)}>{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        {progress !== undefined && (
          <div className="h-1.5 rounded bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
