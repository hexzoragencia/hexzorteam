"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BellRing, Plus, Trash2, Pencil, Save, Check, X as Close,
  Calendar, AlertTriangle, CheckCircle2, Clock, Repeat,
} from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";

type PagoDelMes = {
  id: string; espacio_id: string;
  nombre: string; monto: number; dia_pago: number;
  recurrencia: "mensual" | "semanal" | "anual" | "unico";
  categoria_id: string | null; activo: boolean; notas: string | null;
  fecha_vencimiento: string;
  pago_realizado_id: string | null;
  fecha_pago: string | null;
  monto_pagado: number | null;
  estado: "pagado" | "vencido" | "proximo" | "pendiente";
};

type Categoria = { id: string; nombre: string; tipo: string };

type Recurrencia = "mensual" | "semanal" | "anual" | "unico";
const FORM_DEFAULT: { nombre: string; monto: number | ""; dia_pago: number | ""; categoria_id: string; recurrencia: Recurrencia; notas: string } = {
  nombre: "", monto: "", dia_pago: "",
  categoria_id: "", recurrencia: "mensual",
  notas: "",
};

const DIAS = Array.from({ length: 31 }, (_, i) => i + 1);

function diasRestantes(fecha: string): number {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const venc = new Date(fecha + "T00:00:00");
  return Math.round((venc.getTime() - hoy.getTime()) / 86400000);
}

export function PagosClient({ espacioId, moneda, pagos, categorias }: {
  espacioId: string; moneda: string;
  pagos: PagoDelMes[];
  categorias: Categoria[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_DEFAULT);
  const [saving, setSaving] = useState(false);

  // Stats
  const totalMes = pagos.reduce((s, p) => s + Number(p.monto), 0);
  const totalPagado = pagos.filter(p => p.estado === "pagado").reduce((s, p) => s + Number(p.monto_pagado ?? p.monto), 0);
  const totalPendiente = pagos.filter(p => p.estado !== "pagado").reduce((s, p) => s + Number(p.monto), 0);
  const vencidos = pagos.filter(p => p.estado === "vencido");
  const proximos = pagos.filter(p => p.estado === "proximo");
  const pendientes = pagos.filter(p => p.estado === "pendiente");
  const pagados = pagos.filter(p => p.estado === "pagado");

  function abrirCrear() {
    setForm(FORM_DEFAULT); setEditing(null); setShowForm(true);
  }
  function abrirEditar(p: PagoDelMes) {
    setForm({
      nombre: p.nombre, monto: Number(p.monto), dia_pago: Number(p.dia_pago),
      categoria_id: p.categoria_id ?? "",
      recurrencia: p.recurrencia,
      notas: p.notas ?? "",
    });
    setEditing(p.id); setShowForm(true);
  }
  function cancelar() {
    setShowForm(false); setEditing(null); setForm(FORM_DEFAULT);
  }

  async function guardar() {
    const nombre = form.nombre.trim();
    if (!nombre) { alert("Falta el nombre"); return; }
    if (typeof form.monto !== "number" || form.monto <= 0) { alert("Monto inválido"); return; }
    if (typeof form.dia_pago !== "number" || form.dia_pago < 1 || form.dia_pago > 31) { alert("Día inválido (1-31)"); return; }
    setSaving(true);
    const payload: any = {
      espacio_id: espacioId,
      nombre, monto: Number(form.monto), dia_pago: Number(form.dia_pago),
      categoria_id: null,
      recurrencia: form.recurrencia,
      notas: form.notas.trim() || null,
    };
    if (editing) {
      const { error } = await supabase.from("pagos_programados").update(payload).eq("id", editing);
      setSaving(false);
      if (error) { alert(error.message); return; }
    } else {
      const { error } = await supabase.from("pagos_programados").insert(payload);
      setSaving(false);
      if (error) { alert(error.message); return; }
    }
    cancelar();
    router.refresh();
  }

  async function borrar(id: string, nombre: string) {
    if (!confirm(`¿Borrar el pago "${nombre}"? El histórico se conserva pero ya no aparece en próximos meses.`)) return;
    const { error } = await supabase.from("pagos_programados").update({ activo: false }).eq("id", id);
    if (error) { alert(error.message); return; }
    router.refresh();
  }

  async function marcarPagado(p: PagoDelMes) {
    if (!confirm(`¿Marcar "${p.nombre}" como pagado hoy? Se creará una transacción automáticamente.`)) return;

    // Crear transacción
    const { data: tx, error: errTx } = await supabase.from("transacciones").insert({
      espacio_id: espacioId,
      categoria_id: p.categoria_id,
      fecha: new Date().toISOString().slice(0, 10),
      monto: Number(p.monto),
      descripcion: `Pago: ${p.nombre}`,
    }).select().single();
    if (errTx) { alert(errTx.message); return; }

    // Crear pago_realizado vinculado
    const { error: errPr } = await supabase.from("pagos_realizados").insert({
      pago_id: p.id,
      espacio_id: espacioId,
      fecha_pago: new Date().toISOString().slice(0, 10),
      monto_pagado: Number(p.monto),
      transaccion_id: tx?.id,
    });
    if (errPr) { alert(errPr.message); return; }

    router.refresh();
  }

  async function deshacerPago(p: PagoDelMes) {
    if (!p.pago_realizado_id) return;
    if (!confirm(`¿Deshacer el pago de "${p.nombre}"? Borra también la transacción.`)) return;
    // Borrar pago_realizado y transacción asociada
    const { data: pr } = await supabase.from("pagos_realizados").select("transaccion_id").eq("id", p.pago_realizado_id).maybeSingle();
    if (pr?.transaccion_id) {
      await supabase.from("transacciones").delete().eq("id", pr.transaccion_id);
    }
    await supabase.from("pagos_realizados").delete().eq("id", p.pago_realizado_id);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BellRing className="h-7 w-7 text-primary" /> Pagos del mes
          </h1>
          <p className="text-muted-foreground text-sm">Tus pagos recurrentes con fecha. Te aviso cuando se acercan o vencen.</p>
        </div>
        <Button data-tour="pagos-nuevo" onClick={abrirCrear}><Plus className="h-4 w-4 mr-1" /> Nuevo pago</Button>
      </div>

      {/* KPIs */}
      <div data-tour="pagos-kpis" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiBox label="Total del mes" value={formatMoney(totalMes, moneda)} sub={`${pagos.length} pagos`} />
        <KpiBox label="Ya pagué" value={formatMoney(totalPagado, moneda)} sub={`${pagados.length} pagos`} color="success" />
        <KpiBox label="Falta pagar" value={formatMoney(totalPendiente, moneda)} sub={`${pendientes.length + proximos.length + vencidos.length} pagos`} color={vencidos.length > 0 ? "destructive" : "primary"} />
        <KpiBox label="Vencidos" value={vencidos.length.toString()} sub={vencidos.length > 0 ? "⚠️ pagar urgente" : "Todo al día"} color={vencidos.length > 0 ? "destructive" : "success"} />
      </div>

      {/* Form */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">{editing ? "Editar pago" : "Nuevo pago"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nombre *</Label>
                <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Internet, Netflix, Renta" />
              </div>
              <div className="space-y-1">
                <Label>Monto ({moneda}) *</Label>
                <Input type="number" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value === "" ? "" : Number(e.target.value) })} placeholder="50000" />
              </div>
              <div className="space-y-1">
                <Label>Día de pago (1-31) *</Label>
                <select
                  value={form.dia_pago}
                  onChange={(e) => setForm({ ...form, dia_pago: e.target.value === "" ? "" : Number(e.target.value) })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecciona</option>
                  {DIAS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Recurrencia</Label>
                <select
                  value={form.recurrencia}
                  onChange={(e) => setForm({ ...form, recurrencia: e.target.value as any })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="mensual">Mensual</option>
                  <option value="semanal">Semanal</option>
                  <option value="anual">Anual</option>
                  <option value="unico">Único (un solo pago)</option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Notas (opcional)</Label>
                <Input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Ej. Plan familiar Netflix, número de cuenta, etc." />
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

      <div data-tour="pagos-lista">
      {/* Vencidos (urgentes) */}
      {vencidos.length > 0 && (
        <SectionPagos
          titulo="⚠️ Vencidos"
          color="destructive"
          pagos={vencidos}
          moneda={moneda}
          onMarcar={marcarPagado}
          onEditar={abrirEditar}
          onBorrar={borrar}
        />
      )}

      {/* Próximos (≤2 días) */}
      {proximos.length > 0 && (
        <SectionPagos
          titulo="🔔 Próximos (en 2 días o menos)"
          color="warning"
          pagos={proximos}
          moneda={moneda}
          onMarcar={marcarPagado}
          onEditar={abrirEditar}
          onBorrar={borrar}
        />
      )}

      {/* Pendientes (más adelante) */}
      {pendientes.length > 0 && (
        <SectionPagos
          titulo="📅 Pendientes este mes"
          pagos={pendientes}
          moneda={moneda}
          onMarcar={marcarPagado}
          onEditar={abrirEditar}
          onBorrar={borrar}
        />
      )}

      {/* Pagados */}
      {pagados.length > 0 && (
        <SectionPagos
          titulo="✅ Ya pagados este mes"
          color="success"
          pagos={pagados}
          moneda={moneda}
          onMarcar={() => {}}
          onEditar={abrirEditar}
          onBorrar={borrar}
          onDeshacer={deshacerPago}
        />
      )}

      </div>
      {pagos.length === 0 && (
        <Card className="border-2 border-dashed">
          <CardContent className="py-10 text-center space-y-2">
            <BellRing className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aún no tienes pagos programados.</p>
            <Button onClick={abrirCrear} variant="outline">
              <Plus className="h-4 w-4 mr-1" /> Agregar el primero
            </Button>
            <p className="text-[11px] text-muted-foreground max-w-md mx-auto pt-2">
              💡 Tip: También puedes pedirle al Coach IA "agrega el pago de Netflix de 36k todos los días 5".
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SectionPagos({ titulo, color, pagos, moneda, onMarcar, onEditar, onBorrar, onDeshacer }: {
  titulo: string;
  color?: "destructive" | "warning" | "success";
  pagos: PagoDelMes[];
  moneda: string;
  onMarcar: (p: PagoDelMes) => void;
  onEditar: (p: PagoDelMes) => void;
  onBorrar: (id: string, nombre: string) => void;
  onDeshacer?: (p: PagoDelMes) => void;
}) {
  const cardClass = cn(
    color === "destructive" && "border-destructive/40 bg-destructive/5",
    color === "warning" && "border-warning/40 bg-warning/5",
    color === "success" && "border-success/40 bg-success/5",
  );
  return (
    <Card className={cardClass}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{titulo} <span className="text-xs text-muted-foreground font-normal">({pagos.length})</span></CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {pagos.map(p => {
            const dias = diasRestantes(p.fecha_vencimiento);
            const ya = p.estado === "pagado";
            return (
              <li key={p.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold flex items-center gap-2">
                    {p.nombre}
                    {p.recurrencia !== "unico" && <span title={p.recurrencia}><Repeat className="h-3 w-3 text-muted-foreground" /></span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Día {p.dia_pago} de cada mes
                    {!ya && (
                      <> · {dias < 0 ? `vencido hace ${Math.abs(dias)}d` : dias === 0 ? "vence HOY" : `vence en ${dias}d`}</>
                    )}
                    {ya && p.fecha_pago && <> · pagado el {p.fecha_pago}</>}
                  </div>
                  {p.notas && <p className="text-[11px] text-muted-foreground mt-0.5">{p.notas}</p>}
                </div>
                <div className="text-right">
                  <div className="font-bold tabular-nums">{formatMoney(p.monto, moneda)}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {!ya && (
                    <Button size="sm" variant="default" onClick={() => onMarcar(p)} className="h-8 text-xs">
                      <Check className="h-3.5 w-3.5 mr-1" /> Pagar
                    </Button>
                  )}
                  {ya && onDeshacer && (
                    <Button size="sm" variant="outline" onClick={() => onDeshacer(p)} className="h-8 text-xs">
                      Deshacer
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => onEditar(p)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => onBorrar(p.id, p.nombre)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function KpiBox({ label, value, sub, color }: {
  label: string; value: string; sub?: string;
  color?: "success" | "destructive" | "primary" | "warning";
}) {
  const colorClass =
    color === "success" ? "text-success" :
    color === "destructive" ? "text-destructive" :
    color === "warning" ? "text-warning" :
    color === "primary" ? "text-primary" :
    "text-foreground";
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
        <div className={cn("text-2xl font-bold tabular-nums mt-1", colorClass)}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
