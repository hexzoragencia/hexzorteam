"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { formatMoney, cn } from "@/lib/utils";
import type { FondoReserva, Espacio } from "@/lib/types";
import { PiggyBank, Plus, Trash2, Pencil, Check, X, Target, TrendingUp, Wallet, Calendar } from "lucide-react";

type Form = { nombre: string; meta: number | ""; pago_mensual: number | ""; inicial: number | ""; ahorrado: number | "" };
const EMPTY: Form = { nombre: "", meta: "", pago_mensual: "", inicial: "", ahorrado: "" };

export function FondosClient({ espacio, initial }: { espacio: Espacio; initial: FondoReserva[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [fondos, setFondos] = useState<FondoReserva[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ id: string; monto: number | "" } | null>(null);

  const totalMeta = fondos.reduce((s, f) => s + Number(f.meta), 0);
  const totalAhorrado = fondos.reduce((s, f) => s + Number(f.ahorrado) + Number(f.inicial), 0);
  const totalMensual = fondos.reduce((s, f) => s + Number(f.pago_mensual), 0);
  const totalFalta = Math.max(0, totalMeta - totalAhorrado);
  const progresoTotal = totalMeta > 0 ? (totalAhorrado / totalMeta) * 100 : 0;

  function startEdit(f: FondoReserva) {
    setEditingId(f.id);
    setForm({ nombre: f.nombre, meta: Number(f.meta), pago_mensual: Number(f.pago_mensual), inicial: Number(f.inicial), ahorrado: Number(f.ahorrado) });
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false); setEditingId(null); setForm(EMPTY);
  }

  async function guardar() {
    const nombre = form.nombre.trim();
    if (!nombre) { alert("El nombre es requerido"); return; }
    const meta = Number(form.meta || 0);
    if (meta <= 0) { alert("La meta debe ser mayor a 0"); return; }
    const payload = {
      espacio_id: espacio.id,
      nombre,
      meta,
      pago_mensual: Number(form.pago_mensual || 0),
      inicial: Number(form.inicial || 0),
      ahorrado: Number(form.ahorrado || 0),
    };
    if (editingId) {
      const { data, error } = await supabase.from("fondos_reserva").update(payload).eq("id", editingId).select().single();
      if (error) { alert(error.message); return; }
      setFondos(fondos.map(f => f.id === editingId ? (data as FondoReserva) : f));
    } else {
      const { data, error } = await supabase.from("fondos_reserva").insert(payload).select().single();
      if (error) { alert(error.message); return; }
      setFondos([...fondos, data as FondoReserva]);
    }
    cancel();
    router.refresh();
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar este fondo? Esta acción no se puede deshacer.")) return;
    const { error } = await supabase.from("fondos_reserva").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setFondos(fondos.filter(f => f.id !== id));
    router.refresh();
  }

  async function sumarAhorro(f: FondoReserva, monto: number) {
    const nuevoAhorrado = Number(f.ahorrado) + monto;
    const { data, error } = await supabase.from("fondos_reserva").update({ ahorrado: nuevoAhorrado }).eq("id", f.id).select().single();
    if (error) { alert(error.message); return; }
    setFondos(fondos.map(x => x.id === f.id ? (data as FondoReserva) : x));
    setAdding(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Ahorros</h1>
          <p className="text-muted-foreground">Ahorros con metas. Cada uno con su progreso y fecha estimada de cumplimiento.</p>
        </div>
        {!showForm && (
          <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY); }}>
            <Plus className="h-4 w-4 mr-1" /> Nuevo ahorro
          </Button>
        )}
      </div>

      {/* KPIs globales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiBox title="Meta total" value={formatMoney(totalMeta, espacio.moneda)} icon={<Target />} color="text-primary" />
        <KpiBox title="Total ahorrado" value={formatMoney(totalAhorrado, espacio.moneda)} icon={<Wallet />} color="text-success" />
        <KpiBox title="Ahorro mensual" value={formatMoney(totalMensual, espacio.moneda)} icon={<TrendingUp />} color="text-blue-500" />
        <KpiBox title="Falta para meta" value={formatMoney(totalFalta, espacio.moneda)} icon={<Calendar />} color="text-orange-500"
          extra={<div className="mt-2"><div className="h-1.5 rounded bg-muted overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${Math.min(progresoTotal, 100)}%` }} /></div><p className="text-xs text-muted-foreground mt-1">{progresoTotal.toFixed(1)}% del total cumplido</p></div>} />
      </div>

      {/* Form de crear/editar */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle>{editingId ? "Editar ahorro" : "Nuevo ahorro"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Nombre</label>
                <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. CARRO, VIAJES, EMERGENCIAS..." autoFocus />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Meta total</label>
                <MoneyInput value={form.meta} onValueChange={(v) => setForm({ ...form, meta: v })} placeholder="80,000,000" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Aporte mensual planeado</label>
                <MoneyInput value={form.pago_mensual} onValueChange={(v) => setForm({ ...form, pago_mensual: v })} placeholder="500,000" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Monto inicial (lo que ya tenías)</label>
                <MoneyInput value={form.inicial} onValueChange={(v) => setForm({ ...form, inicial: v })} placeholder="0" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-muted-foreground">Ahorrado adicional (lo que has ido sumando)</label>
                <MoneyInput value={form.ahorrado} onValueChange={(v) => setForm({ ...form, ahorrado: v })} placeholder="0" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={guardar}><Check className="h-4 w-4 mr-1" /> Guardar</Button>
              <Button variant="outline" onClick={cancel}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de fondos */}
      {fondos.length === 0 && !showForm ? (
        <Card>
          <CardContent className="pt-6 text-center space-y-3 py-12">
            <PiggyBank className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No tienes fondos creados. Empieza con uno (carro, viajes, emergencias…).</p>
            <Button onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY); }}>
              <Plus className="h-4 w-4 mr-1" /> Crear primer fondo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {fondos.map((f) => {
            const total = Number(f.ahorrado) + Number(f.inicial);
            const meta = Number(f.meta);
            const falta = Math.max(0, meta - total);
            const pct = meta > 0 ? (total / meta) * 100 : 0;
            const mensual = Number(f.pago_mensual);
            const meses = mensual > 0 && falta > 0 ? Math.ceil(falta / mensual) : (falta === 0 ? 0 : null);
            const isAdding = adding?.id === f.id;

            return (
              <Card key={f.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg flex items-center gap-2"><PiggyBank className="h-5 w-5 text-primary" /> {f.nombre}</CardTitle>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(f)} className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => borrar(f.id)} className="h-8 w-8"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Barra de progreso */}
                  <div>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium tabular-nums">{formatMoney(total, espacio.moneda)}</span>
                      <span className="text-muted-foreground">de {formatMoney(meta, espacio.moneda)}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full transition-all", pct >= 100 ? "bg-success" : "bg-primary")} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1.5 tabular-nums">
                      <span>{pct.toFixed(1)}% completado</span>
                      <span>Falta {formatMoney(falta, espacio.moneda)}</span>
                    </div>
                  </div>

                  {/* Meta cumplida o estimación */}
                  {pct >= 100 ? (
                    <div className="rounded-md bg-success/10 border border-success/30 p-2.5 text-sm text-center">
                      🎉 ¡Meta cumplida!
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-md bg-muted/40 p-2.5">
                        <p className="text-xs text-muted-foreground">Aporte mensual</p>
                        <p className="font-semibold tabular-nums">{mensual > 0 ? formatMoney(mensual, espacio.moneda) : "Sin aporte"}</p>
                      </div>
                      <div className="rounded-md bg-muted/40 p-2.5">
                        <p className="text-xs text-muted-foreground">Meses para meta</p>
                        <p className="font-semibold tabular-nums">{meses === null ? "—" : `${meses} ${meses === 1 ? "mes" : "meses"}`}</p>
                      </div>
                    </div>
                  )}

                  {/* Sumar al ahorro */}
                  {isAdding ? (
                    <div className="flex gap-2 items-center">
                      <MoneyInput
                        value={adding!.monto}
                        onValueChange={(v) => setAdding({ id: f.id, monto: v })}
                        placeholder="Monto a sumar"
                      />
                      <Button size="sm" onClick={() => sumarAhorro(f, Number(adding!.monto || 0))} disabled={!adding!.monto}><Check className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setAdding(null)}><X className="h-4 w-4" /></Button>
                    </div>
                  ) : pct < 100 && (
                    <Button variant="outline" className="w-full" onClick={() => setAdding({ id: f.id, monto: "" })}>
                      <Plus className="h-4 w-4 mr-1" /> Sumar al ahorro
                    </Button>
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

function KpiBox({ title, value, icon, color, extra }: { title: string; value: string; icon: React.ReactNode; color: string; extra?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("h-4 w-4", color)}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold tabular-nums", color)}>{value}</div>
        {extra}
      </CardContent>
    </Card>
  );
}
