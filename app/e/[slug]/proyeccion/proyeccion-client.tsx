"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, Save, Calendar, TrendingUp, Plus, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";

type Meta = {
  id?: string; espacio_id?: string;
  meta_ventas_iniciales: number; pct_confirmacion: number; pct_entrega: number;
  meta_gastos_fijos: number; meta_ganancia: number;
  meta_ventas_diarias: number; meta_ventas_semanales: number; meta_ventas_mensuales: number;
  meta_productos_testeo_mes: number;
  observacion: string | null;
};
type Tracking = {
  id: string; espacio_id: string; fecha: string;
  ventas_dia: number; productos_montados: number; observacion: string | null;
};

const META_DEFAULT: Meta = {
  meta_ventas_iniciales: 500,
  pct_confirmacion: 0.80,
  pct_entrega: 0.80,
  meta_gastos_fijos: 6400000,
  meta_ganancia: 20352000,
  meta_ventas_diarias: 53,
  meta_ventas_semanales: 371,
  meta_ventas_mensuales: 1590,
  meta_productos_testeo_mes: 25,
  observacion: null,
};

function hoyIso() {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date());
}

export function ProyeccionClient({ espacioId, moneda, meta: metaInicial, tracking: trackingInicial }: {
  espacioId: string; moneda: string;
  meta: Meta | null;
  tracking: Tracking[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [meta, setMeta] = useState<Meta>(metaInicial ?? META_DEFAULT);
  const [tracking, setTracking] = useState<Tracking[]>(trackingInicial);
  const [savingMeta, setSavingMeta] = useState(false);

  // Form para nuevo registro de tracking
  const [formFecha, setFormFecha] = useState(hoyIso());
  const [formVentas, setFormVentas] = useState<number | "">("");
  const [formProductos, setFormProductos] = useState<number | "">("");
  const [savingTrack, setSavingTrack] = useState(false);

  const stats = useMemo(() => {
    const hoy = hoyIso();
    const lunes = new Date(hoy + "T00:00:00");
    lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
    const lunesIso = lunes.toISOString().slice(0, 10);
    const inicioMes = hoy.slice(0, 7) + "-01";

    const tHoy = tracking.find(t => t.fecha === hoy);
    const tSem = tracking.filter(t => t.fecha >= lunesIso);
    const tMes = tracking.filter(t => t.fecha >= inicioMes);

    const ventasHoy = tHoy?.ventas_dia ?? 0;
    const ventasSem = tSem.reduce((s, t) => s + t.ventas_dia, 0);
    const ventasMes = tMes.reduce((s, t) => s + t.ventas_dia, 0);
    const productosMes = tMes.reduce((s, t) => s + t.productos_montados, 0);

    const pctHoy = meta.meta_ventas_diarias > 0 ? (ventasHoy / meta.meta_ventas_diarias) * 100 : 0;
    const pctSem = meta.meta_ventas_semanales > 0 ? (ventasSem / meta.meta_ventas_semanales) * 100 : 0;
    const pctMes = meta.meta_ventas_mensuales > 0 ? (ventasMes / meta.meta_ventas_mensuales) * 100 : 0;
    const pctProductos = meta.meta_productos_testeo_mes > 0 ? (productosMes / meta.meta_productos_testeo_mes) * 100 : 0;

    return { ventasHoy, ventasSem, ventasMes, productosMes, pctHoy, pctSem, pctMes, pctProductos };
  }, [tracking, meta]);

  // Cálculo derivado de las "ventas iniciales" (parte 1 del Excel)
  const calcInicial = useMemo(() => {
    const v = meta.meta_ventas_iniciales;
    const conf = v * meta.pct_confirmacion;
    const entr = conf * meta.pct_entrega;
    return { confirmadas: conf, entregadas: entr };
  }, [meta]);

  async function guardarMeta() {
    setSavingMeta(true);
    const payload: any = { espacio_id: espacioId, ...meta };
    delete payload.id;
    const { error } = await supabase.from("emp_metas").upsert(payload, { onConflict: "espacio_id" });
    setSavingMeta(false);
    if (error) { alert(error.message); return; }
    router.refresh();
  }

  async function agregarTracking() {
    if (!formFecha) { alert("Falta la fecha"); return; }
    setSavingTrack(true);
    const payload = {
      espacio_id: espacioId, fecha: formFecha,
      ventas_dia: typeof formVentas === "number" ? formVentas : 0,
      productos_montados: typeof formProductos === "number" ? formProductos : 0,
    };
    const { data, error } = await supabase.from("emp_metas_tracking")
      .upsert(payload, { onConflict: "espacio_id,fecha" }).select().single();
    setSavingTrack(false);
    if (error) { alert(error.message); return; }
    setTracking([data as Tracking, ...tracking.filter(t => t.fecha !== formFecha)]);
    setFormVentas(""); setFormProductos("");
    router.refresh();
  }

  async function borrarTracking(id: string) {
    if (!confirm("¿Borrar este registro?")) return;
    const { error } = await supabase.from("emp_metas_tracking").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setTracking(tracking.filter(t => t.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Target className="h-7 w-7 text-primary" /> Proyección & Metas
        </h1>
        <p className="text-muted-foreground text-sm">Define tus metas y haz seguimiento diario para ver si las cumples.</p>
      </div>

      {/* KPIs de cumplimiento */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiProgreso label="Hoy" actual={stats.ventasHoy} meta={meta.meta_ventas_diarias} pct={stats.pctHoy} />
        <KpiProgreso label="Semana" actual={stats.ventasSem} meta={meta.meta_ventas_semanales} pct={stats.pctSem} />
        <KpiProgreso label="Mes" actual={stats.ventasMes} meta={meta.meta_ventas_mensuales} pct={stats.pctMes} />
        <KpiProgreso label="Productos testeo" actual={stats.productosMes} meta={meta.meta_productos_testeo_mes} pct={stats.pctProductos} />
      </div>

      {/* Tracking diario rápido */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Registrar día</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label htmlFor="trk_fecha">Fecha</Label>
              <Input id="trk_fecha" type="date" value={formFecha} onChange={(e) => setFormFecha(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="trk_ventas">Ventas del día</Label>
              <Input id="trk_ventas" type="number" placeholder="0" value={formVentas}
                onChange={(e) => setFormVentas(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="trk_prod">Productos nuevos montados</Label>
              <Input id="trk_prod" type="number" placeholder="0" value={formProductos}
                onChange={(e) => setFormProductos(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div className="flex items-end">
              <Button onClick={agregarTracking} disabled={savingTrack} className="w-full">
                {savingTrack ? "Guardando..." : "Guardar día"}
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Si ya existe un registro para esa fecha, se actualiza.</p>
        </CardContent>
      </Card>

      {/* Cálculo "ventas iniciales" del Excel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Cálculo del flujo (mes a mes)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Ventas iniciales del mes</Label>
              <Input type="number" value={meta.meta_ventas_iniciales}
                onChange={(e) => setMeta({ ...meta, meta_ventas_iniciales: Number(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1">
              <Label>% Confirmación (0–1)</Label>
              <Input type="number" step="0.01" value={meta.pct_confirmacion}
                onChange={(e) => setMeta({ ...meta, pct_confirmacion: Number(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1">
              <Label>% Entrega (0–1)</Label>
              <Input type="number" step="0.01" value={meta.pct_entrega}
                onChange={(e) => setMeta({ ...meta, pct_entrega: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 grid sm:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Ventas iniciales</p>
              <p className="text-xl font-bold tabular-nums">{meta.meta_ventas_iniciales}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Confirmadas ({(meta.pct_confirmacion * 100).toFixed(0)}%)</p>
              <p className="text-xl font-bold tabular-nums">{calcInicial.confirmadas.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entregadas ({(meta.pct_entrega * 100).toFixed(0)}%)</p>
              <p className="text-xl font-bold tabular-nums">{calcInicial.entregadas.toFixed(0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuración general */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4" /> Metas operativas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <NumField label="Meta ventas / día" value={meta.meta_ventas_diarias} onChange={(v) => setMeta({ ...meta, meta_ventas_diarias: v })} />
            <NumField label="Meta ventas / semana" value={meta.meta_ventas_semanales} onChange={(v) => setMeta({ ...meta, meta_ventas_semanales: v })} />
            <NumField label="Meta ventas / mes" value={meta.meta_ventas_mensuales} onChange={(v) => setMeta({ ...meta, meta_ventas_mensuales: v })} />
            <NumField label="Productos / mes (testeo)" value={meta.meta_productos_testeo_mes} onChange={(v) => setMeta({ ...meta, meta_productos_testeo_mes: v })} />
            <NumField label={`Meta gastos fijos (${moneda})`} value={meta.meta_gastos_fijos} onChange={(v) => setMeta({ ...meta, meta_gastos_fijos: v })} step={1000} />
            <NumField label={`Meta ganancia (${moneda})`} value={meta.meta_ganancia} onChange={(v) => setMeta({ ...meta, meta_ganancia: v })} step={1000} />
          </div>
          <div className="space-y-1">
            <Label>Observación</Label>
            <textarea
              rows={2} value={meta.observacion ?? ""}
              onChange={(e) => setMeta({ ...meta, observacion: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Notas sobre tus metas..."
            />
          </div>
          <Button onClick={guardarMeta} disabled={savingMeta}>
            <Save className="h-4 w-4 mr-1" /> {savingMeta ? "Guardando..." : "Guardar metas"}
          </Button>
        </CardContent>
      </Card>

      {/* Historial de tracking */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Historial diario</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {tracking.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">Aún no hay registros. Agrega tu primer día arriba.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground border-b">
                  <tr>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-right">Ventas</th>
                    <th className="px-3 py-2 text-right">Productos</th>
                    <th className="px-3 py-2 text-left">Cumple meta diaria</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tracking.map(t => {
                    const cumple = t.ventas_dia >= meta.meta_ventas_diarias;
                    return (
                      <tr key={t.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 whitespace-nowrap">{t.fecha}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{t.ventas_dia}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{t.productos_montados}</td>
                        <td className="px-3 py-2">
                          {cumple ? (
                            <span className="inline-flex items-center gap-1 text-success text-xs font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Cumplida
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                              <XCircle className="h-3.5 w-3.5" /> {meta.meta_ventas_diarias - t.ventas_dia} faltaron
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => borrarTracking(t.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiProgreso({ label, actual, meta, pct }: { label: string; actual: number; meta: number; pct: number }) {
  const cumple = pct >= 100;
  return (
    <Card className={cn(cumple && "border-success/40 bg-success/5")}>
      <CardContent className="pt-5 pb-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
          <span className={cn("font-semibold", cumple ? "text-success" : "text-muted-foreground")}>{pct.toFixed(0)}%</span>
        </div>
        <div className="text-xl font-bold tabular-nums">
          {actual} <span className="text-sm text-muted-foreground font-normal">/ {meta}</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("h-full transition-all", cumple ? "bg-success" : "bg-primary")}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function NumField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </div>
  );
}
