"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/ui/money-input";
import { formatMoney, formatDateLong, relativeDate } from "@/lib/utils";
import { CATEGORIA_TIPOS, type Categoria, type CategoriaTipo } from "@/lib/types";
import { Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

type TxRow = {
  id: string; fecha: string; monto: number; descripcion: string | null;
  categoria_id: string | null;
  categorias: { nombre: string; tipo: CategoriaTipo } | null;
  perfiles: { nombre: string } | null;
};

const TIPO_LABEL = Object.fromEntries(CATEGORIA_TIPOS.map((t) => [t.value, t]));

export function TransaccionesClient({
  espacioId, moneda, categorias, initialTxs,
}: {
  espacioId: string; moneda: string;
  categorias: Categoria[]; initialTxs: TxRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [txs, setTxs] = useState<TxRow[]>(initialTxs);
  // Tipo del movimiento: ingreso (entra plata) o gasto (sale plata)
  const [tipoMov, setTipoMov] = useState<"ingreso" | "gasto">("gasto");
  // Categoría opcional — si vacía, se asigna "Otros ingresos" / "Otros gastos" automáticamente
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [monto, setMonto] = useState<number | "">("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [filtroTipo, setFiltroTipo] = useState<CategoriaTipo | "todos">("todos");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Categorías filtradas según el tipo de movimiento elegido
  const catsParaTipo = useMemo(() => {
    if (tipoMov === "ingreso") return categorias.filter((c) => c.tipo === "ingreso");
    // En "gasto" se aceptan los 4 tipos de salida (gasto_mensual, suscripcion, pago_programado, deuda)
    const tiposGasto = new Set(["gasto_mensual", "suscripcion", "pago_programado", "deuda"]);
    return categorias.filter((c) => tiposGasto.has(c.tipo));
  }, [categorias, tipoMov]);

  // Agrupar para el select cuando es gasto (varios tipos)
  const catsAgrupadas = useMemo(() => {
    const groups: Record<string, Categoria[]> = {};
    for (const c of catsParaTipo) {
      if (!groups[c.tipo]) groups[c.tipo] = [];
      groups[c.tipo].push(c);
    }
    return groups;
  }, [catsParaTipo]);

  // Reset de categoría cuando cambia el tipo
  function cambiarTipo(t: "ingreso" | "gasto") {
    setTipoMov(t);
    setCategoriaId("");
    setError(null);
  }

  const txsFiltradas = useMemo(() => {
    if (filtroTipo === "todos") return txs;
    return txs.filter((t) => t.categorias?.tipo === filtroTipo);
  }, [txs, filtroTipo]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (monto === "" || monto <= 0) { setError("Ingresa un monto válido"); return; }
    setError(null); setLoading(true);

    let catId = categoriaId;

    // Si no eligió categoría, obtener/crear "Otros ingresos" o "Otros gastos" automáticamente
    if (!catId) {
      const tipoFallback = tipoMov === "ingreso" ? "ingreso" : "gasto_mensual";
      const { data: defaultCat, error: rpcError } = await supabase.rpc(
        "get_or_create_categoria_otros",
        { p_espacio_id: espacioId, p_tipo: tipoFallback }
      );
      if (rpcError || !defaultCat) {
        setLoading(false);
        setError(rpcError?.message ?? "No se pudo crear la categoría por defecto");
        return;
      }
      catId = defaultCat as string;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("transacciones").insert({
      espacio_id: espacioId, categoria_id: catId,
      fecha, monto, descripcion: descripcion || null, responsable_id: user?.id,
    }).select("id,fecha,monto,descripcion,categoria_id,categorias(nombre,tipo),perfiles(nombre)").single();

    setLoading(false);
    if (error) { setError(error.message); return; }
    setTxs([data as unknown as TxRow, ...txs]);
    setMonto(""); setDescripcion(""); setCategoriaId("");
    router.refresh();
  };

  const onDelete = async (id: string) => {
    if (!confirm("¿Borrar esta transacción?")) return;
    const { error } = await supabase.from("transacciones").delete().eq("id", id);
    if (!error) setTxs(txs.filter((t) => t.id !== id));
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Transacciones</h1>
        <p className="text-muted-foreground">Registro diario · clasifica cada movimiento por categoría.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Nueva transacción</CardTitle></CardHeader>
        <CardContent>
          {/* Toggle Ingreso / Gasto — botones grandes y claros */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              type="button"
              onClick={() => cambiarTipo("ingreso")}
              className={cn(
                "flex flex-col items-center justify-center gap-1 p-4 rounded-xl border-2 transition",
                tipoMov === "ingreso"
                  ? "border-success bg-success/10 text-success ring-2 ring-success/30"
                  : "border-muted hover:border-success/50 hover:bg-success/5 text-muted-foreground"
              )}
            >
              <TrendingUp className="h-6 w-6" />
              <span className="font-bold text-base">💰 Ingreso</span>
              <span className="text-xs opacity-70">Plata que TE ENTRÓ</span>
            </button>
            <button
              type="button"
              onClick={() => cambiarTipo("gasto")}
              className={cn(
                "flex flex-col items-center justify-center gap-1 p-4 rounded-xl border-2 transition",
                tipoMov === "gasto"
                  ? "border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive/30"
                  : "border-muted hover:border-destructive/50 hover:bg-destructive/5 text-muted-foreground"
              )}
            >
              <TrendingDown className="h-6 w-6" />
              <span className="font-bold text-base">💸 Gasto</span>
              <span className="text-xs opacity-70">Plata que SE FUE</span>
            </button>
          </div>

          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Monto *</Label>
              <MoneyInput value={monto} onValueChange={setMonto} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Fecha — {formatDateLong(fecha)}</Label>
              <Input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Categoría (opcional)</Label>
              <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                <option value="">
                  — Sin categoría (se asigna a "Otros {tipoMov === "ingreso" ? "ingresos" : "gastos"}") —
                </option>
                {tipoMov === "ingreso" ? (
                  catsParaTipo.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))
                ) : (
                  CATEGORIA_TIPOS.filter((t) => catsAgrupadas[t.value]?.length).map((t) => (
                    <optgroup key={t.value} label={`${t.emoji} ${t.label}`}>
                      {catsAgrupadas[t.value].map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </optgroup>
                  ))
                )}
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Si dejas en blanco, se registra como "Otros {tipoMov === "ingreso" ? "ingresos" : "gastos"}" automáticamente.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder={tipoMov === "ingreso"
                  ? "Ej: Venta cliente Juan, sueldo mayo, transferencia mama..."
                  : "Ej: Almuerzo restaurante, renta de casa, gasolina..."}
              />
            </div>
            {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? "Guardando..." : tipoMov === "ingreso" ? "💰 Registrar ingreso" : "💸 Registrar gasto"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Historial ({txsFiltradas.length})</CardTitle>
            <Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as any)} className="w-auto">
              <option value="todos">Todos los tipos</option>
              {CATEGORIA_TIPOS.map((t) => (
                <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {txsFiltradas.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">Sin transacciones para mostrar.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr className="text-left">
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3 hidden md:table-cell">Descripción</th>
                    <th className="p-3 hidden sm:table-cell">Quién</th>
                    <th className="p-3 text-right">Monto</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {txsFiltradas.map((t) => {
                    const tInfo = t.categorias ? TIPO_LABEL[t.categorias.tipo] : null;
                    const isGasto = t.categorias && t.categorias.tipo !== "ingreso";
                    return (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3 whitespace-nowrap">
                          <div className="font-medium">{relativeDate(t.fecha)}</div>
                          <div className="text-xs text-muted-foreground">{formatDateLong(t.fecha)}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{t.categorias?.nombre ?? "—"}</div>
                          {tInfo && <div className="text-xs text-muted-foreground">{tInfo.emoji} {tInfo.label}</div>}
                        </td>
                        <td className="p-3 text-muted-foreground hidden md:table-cell max-w-[280px] truncate">{t.descripcion ?? "—"}</td>
                        <td className="p-3 hidden sm:table-cell">{t.perfiles?.nombre ?? "—"}</td>
                        <td className={`p-3 text-right font-medium tabular-nums ${isGasto ? "text-destructive" : "text-success"}`}>
                          {isGasto ? "-" : "+"}{formatMoney(Number(t.monto), moneda)}
                        </td>
                        <td className="p-3">
                          <Button variant="ghost" size="icon" onClick={() => onDelete(t.id)}>
                            <Trash2 className="h-4 w-4" />
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
