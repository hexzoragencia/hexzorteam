"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { formatMoney, formatDateLong, cn } from "@/lib/utils";
import type { Deuda, SnowballConfig, Espacio } from "@/lib/types";
import { simularSnowball } from "@/lib/snowball";
import { PayoffChart } from "@/components/dashboard/deudas-chart";
import { CreditCard, Plus, Trash2, Pencil, Check, X, Snowflake, Calendar, TrendingDown, Wallet, AlertCircle } from "lucide-react";

type Form = { nombre: string; balance: number | ""; interes_anual_pct: number | ""; cuota_mensual: number | "" };
const EMPTY: Form = { nombre: "", balance: "", interes_anual_pct: "", cuota_mensual: "" };

export function DeudasClient({ espacio, initialDeudas, initialConfig }: {
  espacio: Espacio; initialDeudas: Deuda[]; initialConfig: SnowballConfig | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [deudas, setDeudas] = useState<Deuda[]>(initialDeudas);
  const [cfg, setCfg] = useState<SnowballConfig>(
    initialConfig ?? {
      espacio_id: espacio.id,
      fecha_inicio: new Date().toISOString().slice(0, 10),
      pago_extra_inicial: 0,
      pago_extra_mensual: 0,
    }
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);

  const activas = useMemo(() => deudas.filter(d => !d.pagada && Number(d.balance) > 0), [deudas]);

  const sim = useMemo(() => simularSnowball(
    activas.map(d => ({
      id: d.id, nombre: d.nombre,
      balance: Number(d.balance),
      interes_anual: Number(d.interes_anual),
      cuota_mensual: Number(d.cuota_mensual),
    })),
    new Date(cfg.fecha_inicio + "T00:00:00"),
    Number(cfg.pago_extra_inicial),
    Number(cfg.pago_extra_mensual),
  ), [activas, cfg]);

  // Datos para el gráfico de payoff (cada deuda como serie, columna mes)
  const chartData = useMemo(() => {
    return sim.proyeccion.map(p => {
      const row: any = { mes: p.mes, fecha: p.fecha, total: p.balanceTotal };
      for (const pd of p.porDeuda) row[pd.id] = pd.balance;
      return row;
    });
  }, [sim]);

  function startEdit(d: Deuda) {
    setEditingId(d.id);
    setForm({
      nombre: d.nombre,
      balance: Number(d.balance),
      interes_anual_pct: Number(d.interes_anual) * 100,
      cuota_mensual: Number(d.cuota_mensual),
    });
    setShowForm(true);
  }

  function cancel() { setShowForm(false); setEditingId(null); setForm(EMPTY); }

  async function guardar() {
    const nombre = form.nombre.trim();
    if (!nombre) { alert("El nombre es requerido"); return; }
    const balance = Number(form.balance || 0);
    const cuota = Number(form.cuota_mensual || 0);
    if (balance <= 0 || cuota <= 0) { alert("Balance y cuota mensual deben ser mayores a 0"); return; }
    const payload = {
      espacio_id: espacio.id,
      nombre,
      balance,
      cuota_mensual: cuota,
      interes_anual: Number(form.interes_anual_pct || 0) / 100,
      orden: deudas.length,
    };
    if (editingId) {
      const { data, error } = await supabase.from("deudas").update(payload).eq("id", editingId).select().single();
      if (error) { alert(error.message); return; }
      setDeudas(deudas.map(d => d.id === editingId ? (data as Deuda) : d));
    } else {
      const { data, error } = await supabase.from("deudas").insert(payload).select().single();
      if (error) { alert(error.message); return; }
      setDeudas([...deudas, data as Deuda]);
    }
    cancel();
    router.refresh();
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar esta deuda?")) return;
    const { error } = await supabase.from("deudas").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setDeudas(deudas.filter(d => d.id !== id));
    router.refresh();
  }

  async function togglePagada(d: Deuda) {
    const { data, error } = await supabase.from("deudas").update({ pagada: !d.pagada }).eq("id", d.id).select().single();
    if (error) { alert(error.message); return; }
    setDeudas(deudas.map(x => x.id === d.id ? (data as Deuda) : x));
    router.refresh();
  }

  async function guardarConfig(parcial: Partial<SnowballConfig>) {
    const nueva = { ...cfg, ...parcial };
    setCfg(nueva);
    const { error } = await supabase.from("snowball_config").upsert({
      espacio_id: espacio.id,
      fecha_inicio: nueva.fecha_inicio,
      pago_extra_inicial: Number(nueva.pago_extra_inicial),
      pago_extra_mensual: Number(nueva.pago_extra_mensual),
    });
    if (error) alert(error.message);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Snowflake className="h-8 w-8 text-primary" /> Deudas — Bola de nieve</h1>
          <p className="text-muted-foreground">Estrategia snowball: pagas la deuda más pequeña primero, luego rueda hacia la siguiente.</p>
        </div>
        {!showForm && (
          <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY); }}>
            <Plus className="h-4 w-4 mr-1" /> Nueva deuda
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiBox title="Balance total" value={formatMoney(sim.totales.balance, espacio.moneda)} icon={<Wallet />} color="text-destructive" />
        <KpiBox title="Cuota mensual" value={formatMoney(sim.totales.cuotaMensual, espacio.moneda)} icon={<Calendar />} color="text-orange-500" />
        <KpiBox title="Intereses totales" value={formatMoney(sim.totales.interesesTotales, espacio.moneda)} icon={<TrendingDown />} color="text-yellow-600" />
        <KpiBox
          title="Libre de deudas en"
          value={sim.totales.mesesParaTodas > 0 ? `${sim.totales.mesesParaTodas} meses` : "—"}
          subtitle={sim.totales.mesesParaTodas > 0 ? formatDateLong(sim.totales.fechaLibertad) : undefined}
          icon={<Snowflake />} color="text-success"
        />
      </div>

      {/* Configuración snowball */}
      <Card>
        <CardHeader><CardTitle className="text-base">Configuración bola de nieve</CardTitle></CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Fecha de inicio</label>
              <Input type="date" value={cfg.fecha_inicio} onChange={(e) => guardarConfig({ fecha_inicio: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Pago extra inicial (1ra vez)</label>
              <MoneyInput value={Number(cfg.pago_extra_inicial) || ""} onValueChange={(v) => guardarConfig({ pago_extra_inicial: Number(v || 0) })} placeholder="0" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Pago extra mensual</label>
              <MoneyInput value={Number(cfg.pago_extra_mensual) || ""} onValueChange={(v) => guardarConfig({ pago_extra_mensual: Number(v || 0) })} placeholder="0" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            💡 El "extra mensual" se suma a la deuda más pequeña cada mes. Cuando la cierras, esa cuota + el extra ruedan hacia la siguiente. Esa es la bola de nieve.
          </p>
        </CardContent>
      </Card>

      {/* Form crear/editar */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle>{editingId ? "Editar deuda" : "Nueva deuda"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Nombre</label>
                <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. TARJETA AMERICAN, ADDI, CRÉDITO..." autoFocus />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Balance actual (lo que debes)</label>
                <MoneyInput value={form.balance} onValueChange={(v) => setForm({ ...form, balance: v })} placeholder="8,000,000" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Cuota mensual</label>
                <MoneyInput value={form.cuota_mensual} onValueChange={(v) => setForm({ ...form, cuota_mensual: v })} placeholder="830,000" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Tasa de interés efectiva anual (%)</label>
                <Input
                  type="number" inputMode="decimal" step="0.01" min="0" max="100"
                  value={form.interes_anual_pct}
                  onChange={(e) => setForm({ ...form, interes_anual_pct: e.target.value === "" ? "" : Number(e.target.value) })}
                  placeholder="2"
                />
                <p className="text-xs text-muted-foreground">Ejemplo: si te dicen "EA 24%", escribe <span className="font-mono">24</span>.</p>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={guardar}><Check className="h-4 w-4 mr-1" /> Guardar</Button>
              <Button variant="outline" onClick={cancel}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de deudas */}
      {deudas.length === 0 && !showForm ? (
        <Card>
          <CardContent className="pt-6 text-center space-y-3 py-12">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No tienes deudas registradas. ¡Felicitaciones! 🎉</p>
            <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY); }}>
              <Plus className="h-4 w-4 mr-1" /> Registrar deuda
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Tus deudas (orden snowball)</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2">#</th>
                    <th className="text-left px-4 py-2">Deuda</th>
                    <th className="text-right px-4 py-2">Balance</th>
                    <th className="text-right px-4 py-2">Cuota</th>
                    <th className="text-right px-4 py-2">Interés</th>
                    <th className="text-right px-4 py-2">Intereses tot.</th>
                    <th className="text-right px-4 py-2">Cierra en</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {deudas.map((d, i) => {
                    const resumen = sim.resumenPorDeuda.find(r => r.id === d.id);
                    const isCerrada = d.pagada || Number(d.balance) === 0;
                    return (
                      <tr key={d.id} className={cn("border-t", isCerrada && "opacity-50")}>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-2">
                            {isCerrada ? "✅" : (i === 0 && <Snowflake className="h-3.5 w-3.5 text-primary" />)}
                            <span className={cn(isCerrada && "line-through")}>{d.nombre}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatMoney(Number(d.balance), espacio.moneda)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatMoney(Number(d.cuota_mensual), espacio.moneda)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{(Number(d.interes_anual) * 100).toFixed(1)}%</td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{resumen ? formatMoney(resumen.interesesTotales, espacio.moneda) : "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {resumen && resumen.mesesParaCero > 0 ? (
                            <div>
                              <div className="font-medium">{resumen.mesesParaCero} meses</div>
                              <div className="text-xs text-muted-foreground">{resumen.fechaCero}</div>
                            </div>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => togglePagada(d)} className="h-8 w-8" title={d.pagada ? "Marcar como activa" : "Marcar como pagada"}>
                            {d.pagada ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => startEdit(d)} className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => borrar(d.id)} className="h-8 w-8"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráfico de payoff */}
      {activas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Proyección: cómo se reduce tu deuda mes a mes</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Cada color es una deuda. Verás cómo la bola de nieve va cerrándolas una por una.</p>
          </CardHeader>
          <CardContent>
            <PayoffChart data={chartData} deudas={activas.map(d => ({ id: d.id, nombre: d.nombre }))} currency={espacio.moneda} />
          </CardContent>
        </Card>
      )}

      {/* ⚠️ Deudas impagables: cuota no cubre el interés */}
      {sim.impagables.length > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">⚠️ Deuda(s) que crecen en vez de bajar</p>
            <p className="text-muted-foreground mt-1">La cuota mensual no alcanza ni para pagar los intereses, así que el balance crece cada mes. Necesitas subir la cuota o renegociar:</p>
            <ul className="mt-2 space-y-1">
              {sim.impagables.map(d => (
                <li key={d.id} className="text-xs">
                  • <span className="font-medium">{d.nombre}</span>: cuota {formatMoney(d.cuota_mensual, espacio.moneda)} vs interés mensual {formatMoney(d.interes_mensual, espacio.moneda)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ⚠️ Simulación truncada (más de 50 años) */}
      {sim.totales.truncada && (
        <div className="flex items-start gap-3 rounded-md border border-warning/50 bg-warning/10 p-4 text-sm">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Simulación incompleta</p>
            <p className="text-muted-foreground mt-1">Con la cuota actual no se liquidan en 50 años. Considera subir las cuotas o el pago extra mensual.</p>
          </div>
        </div>
      )}

      {/* Tip educativo */}
      {activas.length > 0 && sim.impagables.length === 0 && Number(cfg.pago_extra_mensual) === 0 && Number(cfg.pago_extra_inicial) === 0 && (
        <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
          <div>
            <p className="font-medium">💡 Acelera tu bola de nieve</p>
            <p className="text-muted-foreground mt-1">Si pones aunque sea $200,000 extra cada mes en la configuración de arriba, vas a ver cuántos meses te ahorras. Pruébalo.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiBox({ title, value, subtitle, icon, color }: { title: string; value: string; subtitle?: string; icon: React.ReactNode; color: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("h-4 w-4", color)}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold tabular-nums", color)}>{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
