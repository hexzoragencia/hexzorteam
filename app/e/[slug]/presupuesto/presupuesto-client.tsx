"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { Select } from "@/components/ui/select";
import { CATEGORIA_TIPOS, type Categoria, type PresupuestoMensual } from "@/lib/types";
import { formatMoney, cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Info, Tags, Receipt } from "lucide-react";

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MESES_LARGOS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

type Tx = { monto: number; categoria_id: string | null; fecha: string };

export function PresupuestoClient({
  espacioId, moneda, ano, mes, slug,
  categorias, presupuestos: initialPres, transacciones,
}: {
  espacioId: string; moneda: string; ano: number; mes: number; slug: string;
  categorias: Categoria[];
  presupuestos: PresupuestoMensual[];
  transacciones: Tx[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [pres, setPres] = useState<PresupuestoMensual[]>(initialPres);
  const [editing, setEditing] = useState<Record<string, number | "">>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Real por categoría (suma de transacciones del mes)
  const realPorCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of transacciones) {
      if (!t.categoria_id) continue;
      m[t.categoria_id] = (m[t.categoria_id] ?? 0) + Number(t.monto);
    }
    return m;
  }, [transacciones]);

  const presPorCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of pres) m[p.categoria_id] = Number(p.monto_esperado);
    return m;
  }, [pres]);

  const guardar = async (catId: string) => {
    const valor = editing[catId];
    if (valor === undefined) return;
    const monto = valor === "" ? 0 : Number(valor);
    setSaving(catId);
    const { data, error } = await supabase.from("presupuestos_mensuales")
      .upsert({ categoria_id: catId, ano, mes, monto_esperado: monto }, { onConflict: "categoria_id,ano,mes" })
      .select().single();
    setSaving(null);
    if (error) { alert(error.message); return; }
    if (data) {
      setPres((curr) => {
        const idx = curr.findIndex((p) => p.categoria_id === catId);
        if (idx === -1) return [...curr, data as PresupuestoMensual];
        const copy = [...curr]; copy[idx] = data as PresupuestoMensual; return copy;
      });
    }
    setEditing((curr) => { const c = { ...curr }; delete c[catId]; return c; });
    router.refresh();
  };

  const cambiarMes = (delta: number) => {
    let nMes = mes + delta;
    let nAno = ano;
    if (nMes < 1) { nMes = 12; nAno -= 1; }
    if (nMes > 12) { nMes = 1; nAno += 1; }
    router.push(`/e/${slug}/presupuesto?ano=${nAno}&mes=${nMes}`);
  };

  // Totales por tipo
  const totalesPorTipo = useMemo(() => {
    const m: Record<string, { esperado: number; real: number }> = {};
    for (const t of CATEGORIA_TIPOS) m[t.value] = { esperado: 0, real: 0 };
    for (const c of categorias) {
      m[c.tipo].esperado += presPorCat[c.id] ?? 0;
      m[c.tipo].real += realPorCat[c.id] ?? 0;
    }
    return m;
  }, [categorias, presPorCat, realPorCat]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Presupuesto</h1>
          <p className="text-muted-foreground">Define lo esperado por categoría · compara contra lo real.</p>
        </div>

      {/* Esta página queda como vista avanzada (no en menú). El módulo principal ahora es Pagos del mes. */}
        <div className="flex items-center gap-2 rounded-lg border bg-card p-1">
          <Button size="icon" variant="ghost" onClick={() => cambiarMes(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-semibold px-2 min-w-[120px] text-center">{MESES_LARGOS[mes - 1]} {ano}</span>
          <Button size="icon" variant="ghost" onClick={() => cambiarMes(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {categorias.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center space-y-3">
            <p className="text-muted-foreground">No hay categorías. Crea categorías para asignar presupuesto.</p>
            <Button asChild><Link href={`/e/${slug}/categorias`}>Ir a categorías</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Totales por tipo */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIA_TIPOS.map((t) => {
              const { esperado, real } = totalesPorTipo[t.value];
              const diff = esperado - real;
              const pct = esperado > 0 ? Math.min(100, (real / esperado) * 100) : 0;
              return (
                <Card key={t.value}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <span>{t.emoji}</span> {t.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Real</span>
                      <span className="font-medium tabular-nums">{formatMoney(real, moneda)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Esperado</span>
                      <span className="tabular-nums">{formatMoney(esperado, moneda)}</span>
                    </div>
                    <div className="h-1.5 rounded bg-muted overflow-hidden mt-1">
                      <div
                        className={cn("h-full transition-all", real > esperado ? "bg-destructive" : "bg-primary")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className={cn("text-xs", diff < 0 ? "text-destructive" : "text-success")}>
                      {diff >= 0 ? "Sobra" : "Excedido"} {formatMoney(Math.abs(diff), moneda)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Tabla por tipo */}
          {CATEGORIA_TIPOS.map((t) => {
            const cats = categorias.filter((c) => c.tipo === t.value);
            if (cats.length === 0) return null;
            return (
              <Card key={t.value}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <span>{t.emoji}</span> {t.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/30">
                      <tr className="text-left">
                        <th className="p-3">Categoría</th>
                        <th className="p-3 text-right w-[180px]">Esperado</th>
                        <th className="p-3 text-right w-[140px]">Real</th>
                        <th className="p-3 text-right w-[140px]">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cats.map((c) => {
                        const espGuardado = presPorCat[c.id] ?? 0;
                        const editVal = editing[c.id];
                        const real = realPorCat[c.id] ?? 0;
                        const esp = editVal !== undefined ? (editVal === "" ? 0 : Number(editVal)) : espGuardado;
                        const diff = esp - real;
                        return (
                          <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="p-3 font-medium">{c.nombre}</td>
                            <td className="p-3">
                              <div className="flex gap-1 items-center justify-end">
                                <div className="w-32">
                                  <MoneyInput
                                    value={editVal !== undefined ? editVal : espGuardado}
                                    onValueChange={(v) => setEditing({ ...editing, [c.id]: v })}
                                    currency=""
                                  />
                                </div>
                                {editVal !== undefined && (
                                  <Button size="sm" onClick={() => guardar(c.id)} disabled={saving === c.id}>
                                    {saving === c.id ? "..." : "OK"}
                                  </Button>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-right tabular-nums">{formatMoney(real, moneda)}</td>
                            <td className={cn("p-3 text-right tabular-nums font-medium", diff < 0 ? "text-destructive" : "text-success")}>
                              {diff >= 0 ? "" : "-"}{formatMoney(Math.abs(diff), moneda)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
