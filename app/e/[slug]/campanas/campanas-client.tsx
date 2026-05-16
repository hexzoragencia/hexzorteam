"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Plus, Trash2, Pencil, Save, Calendar, Calculator } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";

type Campana = {
  id: string; espacio_id: string; producto_id: string | null;
  fecha: string; nombre_campana: string | null;
  efectividad_pct: number | null; flete_devolucion: number | null;
  num_ventas: number; precio_venta: number | null; costo_proveedor: number | null;
  costo_pauta_fb: number | null; costo_pauta_tk: number | null;
  observacion: string | null;
  // Calculados (vista)
  producto_nombre: string | null;
  ventas_efectivas: number; total_publicidad: number; cpa: number;
  utilidad_x_producto_breakeven: number;
  utilidad_x_producto: number; utilidad_neta: number; roi: number;
};

type Producto = { id: string; nombre: string; costo_proveedor: number | null; precio_final: number | null };

type FormState = Partial<Campana>;
const FORM_DEFAULT: FormState = {
  fecha: new Date().toISOString().slice(0, 10),
  nombre_campana: "Testeo",
  efectividad_pct: 0.65,
  num_ventas: 0,
  costo_pauta_fb: 0,
  costo_pauta_tk: 0,
  flete_devolucion: 0,
};

export function CampanasClient({ espacioId, moneda, campanas: initial, productos }: {
  espacioId: string; moneda: string;
  campanas: Campana[];
  productos: Producto[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [campanas, setCampanas] = useState<Campana[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_DEFAULT);
  const [saving, setSaving] = useState(false);

  // Resumen de stats por período (últimos 30 días)
  const stats = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const haceMes = new Date(); haceMes.setDate(haceMes.getDate() - 30);
    const desde = haceMes.toISOString().slice(0, 10);
    const recientes = campanas.filter(c => c.fecha >= desde && c.fecha <= hoy);

    const totalPublicidad = recientes.reduce((s, c) => s + Number(c.total_publicidad), 0);
    const totalVentas = recientes.reduce((s, c) => s + c.num_ventas, 0);
    const totalUtilidad = recientes.reduce((s, c) => s + Number(c.utilidad_neta), 0);
    const cpaPromedio = totalVentas > 0 ? totalPublicidad / totalVentas : 0;
    const roiPromedio = totalPublicidad > 0 ? totalUtilidad / totalPublicidad : 0;
    return { totalPublicidad, totalVentas, totalUtilidad, cpaPromedio, roiPromedio, count: recientes.length };
  }, [campanas]);

  // Resumen del DÍA de hoy (lo que pidió el usuario: gana o pierde HOY)
  const hoyStats = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const dia = campanas.filter(c => c.fecha?.slice(0, 10) === hoy);
    const pauta = dia.reduce((s, c) => s + Number(c.total_publicidad), 0);
    const ventas = dia.reduce((s, c) => s + c.num_ventas, 0);
    const utilidad = dia.reduce((s, c) => s + Number(c.utilidad_neta), 0);
    const cpa = ventas > 0 ? pauta / ventas : 0;
    return { pauta, ventas, utilidad, cpa, count: dia.length, gana: utilidad >= 0 };
  }, [campanas]);

  function abrirCrear() {
    setForm({ ...FORM_DEFAULT });
    setEditing(null);
    setShowForm(true);
  }
  function abrirEditar(c: Campana) {
    setForm({
      ...c,
      // Asegurar formato de fecha
      fecha: c.fecha ? c.fecha.slice(0, 10) : FORM_DEFAULT.fecha,
    });
    setEditing(c.id);
    setShowForm(true);
  }
  function cancelar() {
    setShowForm(false); setEditing(null); setForm(FORM_DEFAULT);
  }

  // Auto-rellenar precio/costo al elegir producto
  function elegirProducto(idProducto: string) {
    const prod = productos.find(p => p.id === idProducto);
    setForm({
      ...form,
      producto_id: idProducto || null,
      precio_venta: prod?.precio_final ?? form.precio_venta,
      costo_proveedor: prod?.costo_proveedor ?? form.costo_proveedor,
    });
  }

  async function guardar() {
    if (!form.fecha) { alert("Falta la fecha"); return; }
    setSaving(true);
    const payload: any = {
      espacio_id: espacioId,
      producto_id: form.producto_id || null,
      fecha: form.fecha,
      nombre_campana: form.nombre_campana || "Testeo",
      efectividad_pct: form.efectividad_pct ?? 0.65,
      flete_devolucion: form.flete_devolucion ?? 0,
      num_ventas: form.num_ventas ?? 0,
      precio_venta: form.precio_venta ?? null,
      costo_proveedor: form.costo_proveedor ?? null,
      costo_pauta_fb: form.costo_pauta_fb ?? 0,
      costo_pauta_tk: form.costo_pauta_tk ?? 0,
      observacion: form.observacion || null,
    };
    if (editing) {
      // Edición: solo actualiza la campaña (no re-suma a proyección ni gastos)
      const { error } = await supabase.from("emp_campanas").update(payload).eq("id", editing);
      setSaving(false);
      if (error) { alert(error.message); return; }
    } else {
      // Registro nuevo: usa el endpoint que ADEMÁS suma ventas a Proyección
      // y registra el gasto de pauta como gasto real en Contabilidad.
      const res = await fetch("/api/campanas/registrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          espacioId,
          producto_id: form.producto_id || null,
          fecha: form.fecha,
          nombre_campana: form.nombre_campana || "Testeo",
          num_ventas: form.num_ventas ?? 0,
          precio_venta: form.precio_venta ?? null,
          costo_proveedor: form.costo_proveedor ?? null,
          costo_pauta_fb: form.costo_pauta_fb ?? 0,
          costo_pauta_tk: form.costo_pauta_tk ?? 0,
          flete_devolucion: form.flete_devolucion ?? 0,
          efectividad_pct: form.efectividad_pct ?? null,
          observacion: form.observacion || null,
        }),
      });
      const json = await res.json();
      setSaving(false);
      if (!res.ok) { alert(json.error ?? "Error al registrar"); return; }
      if (json.avisos?.length) {
        // Feedback breve de lo que se conectó automáticamente
        setTimeout(() => alert("✅ Registrado. " + json.avisos.join(" · ")), 100);
      }
    }
    cancelar();
    router.refresh();
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar este registro de campaña?")) return;
    const { error } = await supabase.from("emp_campanas").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setCampanas(campanas.filter(c => c.id !== id));
    router.refresh();
  }

  // Cálculo en vivo del formulario
  const calc = useMemo(() => {
    const ventas = Number(form.num_ventas ?? 0);
    const efectividad = Number(form.efectividad_pct ?? 0);
    const precio = Number(form.precio_venta ?? 0);
    const costo = Number(form.costo_proveedor ?? 0);
    const flete = Number(form.flete_devolucion ?? 0);
    const pautaFb = Number(form.costo_pauta_fb ?? 0);
    const pautaTk = Number(form.costo_pauta_tk ?? 0);
    const totalPub = pautaFb + pautaTk;
    const cpa = ventas > 0 ? totalPub / ventas : 0;
    const utilidadProd = ventas > 0 && precio > 0 ? (precio - costo - flete) - cpa : 0;
    const ventasEfectivas = ventas * efectividad;
    const utilidadNeta = utilidadProd * ventasEfectivas;
    const roi = totalPub > 0 ? utilidadNeta / totalPub : 0;
    return { totalPub, cpa, utilidadProd, ventasEfectivas, utilidadNeta, roi };
  }, [form]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-primary" /> Campañas ADS
          </h1>
          <p className="text-muted-foreground text-sm">Tracker diario por campaña con cálculo automático de CPA, utilidad y ROI.</p>
        </div>
        <Button onClick={abrirCrear}><Plus className="h-4 w-4 mr-1" /> Nuevo registro</Button>
      </div>

      {/* RESUMEN DE HOY — ¿gano o pierdo hoy? */}
      <div className={cn(
        "rounded-xl border p-4",
        hoyStats.count === 0 ? "border-border bg-card" :
        hoyStats.gana ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"
      )}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Hoy</div>
            {hoyStats.count === 0 ? (
              <p className="text-sm text-muted-foreground mt-1">Aún no registras pauta hoy. Súbele un pantallazo de Meta al coach o crea un registro.</p>
            ) : (
              <div className="flex items-baseline gap-2 mt-1">
                <span className={cn("text-3xl font-bold", hoyStats.gana ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {hoyStats.gana ? "GANANDO" : "PERDIENDO"}
                </span>
                <span className="text-sm text-muted-foreground">
                  utilidad neta {formatMoney(hoyStats.utilidad, moneda)}
                </span>
              </div>
            )}
          </div>
          {hoyStats.count > 0 && (
            <div className="flex gap-4 text-right">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pauta hoy</div>
                <div className="text-lg font-bold tabular-nums">{formatMoney(hoyStats.pauta, moneda)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Ventas</div>
                <div className="text-lg font-bold tabular-nums">{hoyStats.ventas}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">CPA</div>
                <div className="text-lg font-bold tabular-nums">{formatMoney(hoyStats.cpa, moneda)}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPIs últimos 30 días */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MiniKpi label="Registros (30d)" value={stats.count.toString()} />
        <MiniKpi label="Inversión (30d)" value={formatMoney(stats.totalPublicidad, moneda)} />
        <MiniKpi label="Ventas totales" value={stats.totalVentas.toString()} />
        <MiniKpi label="CPA promedio" value={formatMoney(stats.cpaPromedio, moneda)} />
        <MiniKpi label="ROI promedio" value={`${(stats.roiPromedio * 100).toFixed(0)}%`} highlight={stats.roiPromedio > 0} />
      </div>

      {/* Formulario */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-4 w-4" /> {editing ? "Editar campaña" : "Nuevo registro de campaña"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="fecha">Fecha *</Label>
                <Input id="fecha" type="date" value={form.fecha ?? ""} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nombre">Tipo de campaña</Label>
                <Input id="nombre" value={form.nombre_campana ?? ""} onChange={(e) => setForm({ ...form, nombre_campana: e.target.value })} placeholder="Testeo / Escala / etc." />
              </div>
              <div className="space-y-1">
                <Label>Producto (opcional)</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.producto_id ?? ""}
                  onChange={(e) => elegirProducto(e.target.value)}
                >
                  <option value="">— Sin producto vinculado —</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Efectividad (% entrega)</Label>
                <Input
                  type="number" step="0.01" min="0" max="1"
                  value={form.efectividad_pct ?? ""}
                  onChange={(e) => setForm({ ...form, efectividad_pct: e.target.value === "" ? null : Number(e.target.value) })}
                  placeholder="0.65"
                />
                <p className="text-[10px] text-muted-foreground">Ej: 0.65 = 65% (lo que se entrega de cada compra)</p>
              </div>
              <div className="space-y-1">
                <Label># Ventas</Label>
                <Input type="number" step="1" value={form.num_ventas ?? 0} onChange={(e) => setForm({ ...form, num_ventas: Number(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label>Flete + devolución ({moneda})</Label>
                <Input type="number" value={form.flete_devolucion ?? 0} onChange={(e) => setForm({ ...form, flete_devolucion: Number(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label>Precio de venta ({moneda})</Label>
                <Input type="number" value={form.precio_venta ?? ""} onChange={(e) => setForm({ ...form, precio_venta: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Costo proveedor ({moneda})</Label>
                <Input type="number" value={form.costo_proveedor ?? ""} onChange={(e) => setForm({ ...form, costo_proveedor: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div className="space-y-1 col-span-1"></div>
              <div className="space-y-1">
                <Label>Pauta FB ({moneda})</Label>
                <Input type="number" value={form.costo_pauta_fb ?? 0} onChange={(e) => setForm({ ...form, costo_pauta_fb: Number(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label>Pauta TikTok ({moneda})</Label>
                <Input type="number" value={form.costo_pauta_tk ?? 0} onChange={(e) => setForm({ ...form, costo_pauta_tk: Number(e.target.value) || 0 })} />
              </div>
              <div className="space-y-1">
                <Label>Total publicidad</Label>
                <div className="h-10 rounded-md bg-muted px-3 flex items-center text-sm font-semibold tabular-nums">
                  {formatMoney(calc.totalPub, moneda)}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Observación</Label>
              <textarea
                rows={2} value={form.observacion ?? ""}
                onChange={(e) => setForm({ ...form, observacion: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Notas, hallazgos del día..."
              />
            </div>

            {/* Cálculo en vivo */}
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cálculo en vivo</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <CalcRow label="CPA real" value={formatMoney(calc.cpa, moneda)} />
                <CalcRow label="Ventas efectivas" value={calc.ventasEfectivas.toFixed(1)} />
                <CalcRow
                  label="Utilidad neta"
                  value={formatMoney(calc.utilidadNeta, moneda)}
                  positive={calc.utilidadNeta > 0}
                  negative={calc.utilidadNeta < 0}
                />
                <CalcRow
                  label="ROI"
                  value={`${(calc.roi * 100).toFixed(0)}%`}
                  positive={calc.roi > 0}
                  negative={calc.roi < 0}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={guardar} disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : "Guardar"}
              </Button>
              <Button variant="outline" onClick={cancelar}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla / lista de campañas */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Historial</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {campanas.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">Aún no has registrado ninguna campaña. Crea la primera con el botón de arriba.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground border-b">
                  <tr>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Producto</th>
                    <th className="px-3 py-2 text-right">Ventas</th>
                    <th className="px-3 py-2 text-right">Inversión</th>
                    <th className="px-3 py-2 text-right">CPA</th>
                    <th className="px-3 py-2 text-right">Utilidad</th>
                    <th className="px-3 py-2 text-right">ROI</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {campanas.map(c => {
                    const utilidad = Number(c.utilidad_neta);
                    const roi = Number(c.roi);
                    return (
                      <tr key={c.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 whitespace-nowrap">{c.fecha}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium truncate max-w-[200px]">{c.producto_nombre ?? "—"}</div>
                          <div className="text-[10px] text-muted-foreground">{c.nombre_campana}</div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.num_ventas}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(Number(c.total_publicidad), moneda)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(Number(c.cpa), moneda)}</td>
                        <td className={cn("px-3 py-2 text-right tabular-nums font-medium", utilidad > 0 && "text-success", utilidad < 0 && "text-destructive")}>
                          {formatMoney(utilidad, moneda)}
                        </td>
                        <td className={cn("px-3 py-2 text-right tabular-nums font-medium", roi > 0 && "text-success", roi < 0 && "text-destructive")}>
                          {`${(roi * 100).toFixed(0)}%`}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-0.5">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => abrirEditar(c)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => borrar(c.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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

function MiniKpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={cn(highlight && "border-success/40 bg-success/5")}>
      <CardContent className="pt-4 pb-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
        <div className={cn("text-xl font-bold tabular-nums mt-0.5", highlight && "text-success")}>{value}</div>
      </CardContent>
    </Card>
  );
}

function CalcRow({ label, value, positive, negative }: { label: string; value: string; positive?: boolean; negative?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn(
        "font-bold tabular-nums",
        positive && "text-success",
        negative && "text-destructive",
      )}>{value}</div>
    </div>
  );
}
