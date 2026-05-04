import Link from "next/link";
import { requireEspacio } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMoney, formatDateLong, relativeDate, cn } from "@/lib/utils";
import { CATEGORIA_TIPOS, type CategoriaTipo } from "@/lib/types";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, AlertTriangle, Plus } from "lucide-react";

export default async function Dashboard({ params }: { params: { slug: string } }) {
  const espacio = await requireEspacio(params.slug);
  const supabase = createClient();
  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth() + 1;
  const mesIni = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const mesFin = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;

  const [{ data: txAll }, { data: txMes }, { data: cats }, { data: pres }] = await Promise.all([
    supabase.from("transacciones")
      .select("id,fecha,monto,descripcion,categoria_id,categorias(nombre,tipo)")
      .eq("espacio_id", espacio.id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("transacciones")
      .select("monto,categoria_id,categorias(tipo)")
      .eq("espacio_id", espacio.id)
      .gte("fecha", mesIni).lt("fecha", mesFin),
    supabase.from("categorias").select("*").eq("espacio_id", espacio.id),
    supabase.from("presupuestos_mensuales").select("*,categorias(espacio_id,tipo)")
      .eq("ano", ano).eq("mes", mes),
  ]);

  type T = { monto: number; categoria_id: string | null; categorias: { tipo: CategoriaTipo } | null };
  const txMesL = (txMes ?? []) as T[];
  const sumPorTipo = (tipo: CategoriaTipo) =>
    txMesL.filter((t) => t.categorias?.tipo === tipo).reduce((s, t) => s + Number(t.monto), 0);

  const ingresosMes = sumPorTipo("ingreso");
  const gastosMes = (["pago_programado","suscripcion","gasto_mensual","deuda"] as CategoriaTipo[])
    .reduce((s, t) => s + sumPorTipo(t), 0);
  const ahorroMes = sumPorTipo("ahorro");
  const restante = ingresosMes - gastosMes - ahorroMes;

  // Capital all-time
  type TAll = { id: string; fecha: string; monto: number; descripcion: string | null; categoria_id: string | null; categorias: { nombre: string; tipo: CategoriaTipo } | null };
  const txAllL = (txAll ?? []) as TAll[];
  const sumAllTipo = (tipo: CategoriaTipo) =>
    txAllL.filter((t) => t.categorias?.tipo === tipo).reduce((s, t) => s + Number(t.monto), 0);
  const ingTotal = sumAllTipo("ingreso");
  const gastoTotal = (["pago_programado","suscripcion","gasto_mensual","deuda"] as CategoriaTipo[])
    .reduce((s, t) => s + sumAllTipo(t), 0);
  const ahorroTotal = sumAllTipo("ahorro");
  const capital = ingTotal - gastoTotal - ahorroTotal;

  // Presupuesto del mes vs real
  const presEsperadoMes = (pres ?? []).reduce((s: number, p: any) =>
    p.categorias?.espacio_id === espacio.id ? s + Number(p.monto_esperado) : s, 0);

  // Top 5 gastos del mes
  const gastosPorCat: Record<string, { nombre: string; tipo: CategoriaTipo; total: number }> = {};
  for (const t of txMesL) {
    if (!t.categorias || t.categorias.tipo === "ingreso") continue;
    const k = t.categoria_id ?? "_";
    if (!gastosPorCat[k]) gastosPorCat[k] = { nombre: "—", tipo: t.categorias.tipo, total: 0 };
    gastosPorCat[k].total += Number(t.monto);
  }
  // Necesitamos el nombre de la categoría
  const catById = Object.fromEntries((cats ?? []).map((c: any) => [c.id, c]));
  const topGastos = Object.entries(gastosPorCat).map(([id, v]) => ({
    id, nombre: catById[id]?.nombre ?? "Sin categoría",
    tipo: v.tipo, total: v.total,
  })).sort((a, b) => b.total - a.total).slice(0, 5);

  // Alertas
  const alertas: { tipo: "danger" | "warn"; msg: string }[] = [];
  if (capital < 0) alertas.push({ tipo: "danger", msg: `Capital negativo: ${formatMoney(capital, espacio.moneda)}` });
  if (gastosMes > ingresosMes && ingresosMes > 0)
    alertas.push({ tipo: "warn", msg: `Este mes gastaste ${formatMoney(gastosMes - ingresosMes, espacio.moneda)} más de lo que ingresaste.` });
  if (presEsperadoMes > 0 && gastosMes > presEsperadoMes * 1.1)
    alertas.push({ tipo: "warn", msg: `Excediste el presupuesto del mes en ${formatMoney(gastosMes - presEsperadoMes, espacio.moneda)}.` });
  if ((cats ?? []).length === 0)
    alertas.push({ tipo: "warn", msg: "No tienes categorías creadas todavía. Empieza por ahí." });

  const ultimas = txAllL.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">{espacio.nombre} · {espacio.tipo === "personal" ? "Personal" : "Empresarial"}</p>
        </div>
        <Button asChild><Link href={`/e/${espacio.slug}/transacciones`}><Plus className="h-4 w-4 mr-1" /> Nueva transacción</Link></Button>
      </div>

      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => (
            <div key={i} className={cn(
              "flex items-start gap-3 rounded-md border p-3 text-sm",
              a.tipo === "danger" ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-warning/50 bg-warning/10"
            )}>
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{a.msg}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Capital actual" value={formatMoney(capital, espacio.moneda)} icon={<Wallet />} positive={capital >= 0} />
        <StatCard title="Ingresos del mes" value={formatMoney(ingresosMes, espacio.moneda)} icon={<ArrowUpRight />} positive />
        <StatCard title="Gastos del mes" value={formatMoney(gastosMes, espacio.moneda)} icon={<ArrowDownRight />} positive={false} />
        <StatCard title="Restante del mes" value={formatMoney(restante, espacio.moneda)} icon={restante >= 0 ? <TrendingUp /> : <TrendingDown />} positive={restante >= 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Resumen del mes por tipo</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {CATEGORIA_TIPOS.map((t) => {
              const real = sumPorTipo(t.value);
              return (
                <div key={t.value} className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <span>{t.emoji}</span>
                    <span className="text-muted-foreground">{t.label}</span>
                  </span>
                  <span className={cn("tabular-nums font-medium",
                    t.value === "ingreso" ? "text-success" : t.value === "ahorro" ? "" : real > 0 ? "text-destructive" : "")}>
                    {formatMoney(real, espacio.moneda)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top gastos del mes</CardTitle></CardHeader>
          <CardContent>
            {topGastos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin gastos registrados este mes.</p>
            ) : (
              <ul className="space-y-2">
                {topGastos.map((g, i) => {
                  const total = topGastos.reduce((s, x) => s + x.total, 0);
                  const pct = total > 0 ? (g.total / total) * 100 : 0;
                  return (
                    <li key={g.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium truncate">{i + 1}. {g.nombre}</span>
                        <span className="tabular-nums text-muted-foreground">{formatMoney(g.total, espacio.moneda)}</span>
                      </div>
                      <div className="h-1.5 rounded bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Últimas transacciones</CardTitle></CardHeader>
        <CardContent className="p-0">
          {ultimas.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">Sin transacciones registradas. <Link href={`/e/${espacio.slug}/transacciones`} className="underline text-primary">Empieza a registrar</Link>.</p>
          ) : (
            <ul className="divide-y">
              {ultimas.map((t) => {
                const isGasto = t.categorias && t.categorias.tipo !== "ingreso";
                const tInfo = t.categorias ? CATEGORIA_TIPOS.find((x) => x.value === t.categorias!.tipo) : null;
                return (
                  <li key={t.id} className="py-3 px-6 flex justify-between items-center gap-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{t.categorias?.nombre ?? "Sin categoría"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {tInfo?.emoji} {relativeDate(t.fecha)} · {t.descripcion ?? "—"}
                      </p>
                    </div>
                    <span className={cn("tabular-nums font-medium", isGasto ? "text-destructive" : "text-success")}>
                      {isGasto ? "-" : "+"}{formatMoney(Number(t.monto), espacio.moneda)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon, positive }: { title: string; value: string; icon: React.ReactNode; positive: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("h-4 w-4", positive ? "text-success" : "text-destructive")}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold tabular-nums", positive ? "" : "text-destructive")}>{value}</div>
      </CardContent>
    </Card>
  );
}
