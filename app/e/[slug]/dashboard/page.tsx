import Link from "next/link";
import { requireEspacio } from "@/lib/espacio";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatMoney, relativeDate, cn } from "@/lib/utils";
import { CATEGORIA_TIPOS, type CategoriaTipo } from "@/lib/types";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, AlertTriangle, Plus, Target, Clock, CheckCircle2, Calendar } from "lucide-react";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { PieGastoPorTipo, PieLegend, BarTopCategorias, BarGastoDiario, LineAnualIngresoEgreso } from "@/components/dashboard/charts";
import { hoyIso, formatHora, lunesDe, sumarDias } from "@/lib/fechas";
import type { Tarea } from "@/lib/types";
import { TAREA_TIPOS } from "@/lib/types";
import { CoachCard } from "@/components/coach-card";

const TIPOS_GASTO: CategoriaTipo[] = ["pago_programado","suscripcion","gasto_mensual","deuda"];
const MES_NOMBRES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

export default async function Dashboard({
  params, searchParams,
}: { params: { slug: string }; searchParams: { ano?: string; mes?: string } }) {
  const espacio = await requireEspacio(params.slug);
  const supabase = createClient();
  const now = new Date();
  const ano = Number(searchParams.ano) || now.getFullYear();
  const mes = Number(searchParams.mes) || (now.getMonth() + 1);
  const mesIni = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const mesFin = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  const anoIni = `${ano}-01-01`;
  const anoFin = `${ano + 1}-01-01`;
  const diasEnMes = new Date(ano, mes, 0).getDate();

  // Tareas de hoy (solo en espacio personal y solo si la tabla existe)
  let tareasHoy: Tarea[] = [];
  if (espacio.tipo === "personal") {
    try {
      const { data: tH } = await supabase.from("tareas")
        .select("*").eq("espacio_id", espacio.id).eq("fecha", hoyIso())
        .order("hora_inicio", { ascending: true, nullsFirst: false });
      tareasHoy = (tH ?? []) as Tarea[];
    } catch { /* tabla aún no existe */ }
  }

  // Fechas para el corte "Hoy y los últimos días" — siempre actuales, independientes del mes seleccionado.
  const hoyStr = hoyIso();
  const ayerStr = sumarDias(hoyStr, -1);
  const lunesStr = lunesDe(hoyStr);
  const diaActual = now.getDate();
  const mesActualIni = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const [{ data: txMes }, { data: txAno }, { data: txAll }, { data: cats }, { data: presMes }, { data: presAno }, { data: txReciente }] = await Promise.all([
    supabase.from("transacciones")
      .select("id,fecha,monto,descripcion,categoria_id,categorias(nombre,tipo)")
      .eq("espacio_id", espacio.id)
      .gte("fecha", mesIni).lt("fecha", mesFin)
      .order("fecha", { ascending: false }),
    supabase.from("transacciones")
      .select("fecha,monto,categorias(tipo)")
      .eq("espacio_id", espacio.id)
      .gte("fecha", anoIni).lt("fecha", anoFin),
    supabase.from("transacciones")
      .select("monto,categorias(tipo)")
      .eq("espacio_id", espacio.id),
    supabase.from("categorias").select("*").eq("espacio_id", espacio.id),
    supabase.from("presupuestos_mensuales").select("monto_esperado,categoria_id,categorias(espacio_id,tipo,nombre)")
      .eq("ano", ano).eq("mes", mes),
    supabase.from("presupuestos_mensuales").select("monto_esperado,mes,categorias(espacio_id,tipo)")
      .eq("ano", ano),
    supabase.from("transacciones")
      .select("id,fecha,monto,descripcion,categoria_id,categorias(nombre,tipo)")
      .eq("espacio_id", espacio.id)
      .gte("fecha", mesActualIni).lte("fecha", hoyStr)
      .order("fecha", { ascending: false }),
  ]);

  type TxMes = { id: string; fecha: string; monto: number; descripcion: string | null; categoria_id: string | null; categorias: { nombre: string; tipo: CategoriaTipo } | null };
  type TxLite = { fecha?: string; monto: number; categorias: { tipo: CategoriaTipo } | null };
  type Pres = { monto_esperado: number; categoria_id?: string; mes?: number; categorias: { espacio_id: string; tipo: CategoriaTipo; nombre?: string } | null };

  const txM = (txMes ?? []) as unknown as TxMes[];
  const txA = (txAno ?? []) as unknown as TxLite[];
  const txAllL = (txAll ?? []) as unknown as TxLite[];
  const presM = ((presMes ?? []) as unknown as Pres[]).filter(p => p.categorias?.espacio_id === espacio.id);
  const presA = ((presAno ?? []) as unknown as Pres[]).filter(p => p.categorias?.espacio_id === espacio.id);

  // ===== KPIs MES =====
  const sumMesTipo = (tipo: CategoriaTipo) => txM.filter(t => t.categorias?.tipo === tipo).reduce((s, t) => s + Number(t.monto), 0);
  const ingresosMes = sumMesTipo("ingreso");
  const gastosMes = TIPOS_GASTO.reduce((s, t) => s + sumMesTipo(t), 0);
  const ahorroMes = sumMesTipo("ahorro");
  const restante = ingresosMes - gastosMes - ahorroMes;

  const presIngresoMes = presM.filter(p => p.categorias?.tipo === "ingreso").reduce((s, p) => s + Number(p.monto_esperado), 0);
  const presGastoMes = presM.filter(p => p.categorias && TIPOS_GASTO.includes(p.categorias.tipo)).reduce((s, p) => s + Number(p.monto_esperado), 0);
  const pctIngresoCumplido = presIngresoMes > 0 ? (ingresosMes / presIngresoMes) * 100 : null;
  const pctGastoUsado = presGastoMes > 0 ? (gastosMes / presGastoMes) * 100 : null;

  // ===== Capital all-time =====
  const sumAllTipo = (tipo: CategoriaTipo) => txAllL.filter(t => t.categorias?.tipo === tipo).reduce((s, t) => s + Number(t.monto), 0);
  const capital = sumAllTipo("ingreso") - TIPOS_GASTO.reduce((s, t) => s + sumAllTipo(t), 0) - sumAllTipo("ahorro");

  // ===== Hoy y los últimos días (mes actual, no el mes seleccionado) =====
  const txR = (txReciente ?? []) as unknown as TxMes[];
  const isGastoTx = (t: TxMes) => !!t.categorias && t.categorias.tipo !== "ingreso";
  const gastosHoy = txR.filter(t => t.fecha === hoyStr && isGastoTx(t)).reduce((s, t) => s + Number(t.monto), 0);
  const gastosAyer = txR.filter(t => t.fecha === ayerStr && isGastoTx(t)).reduce((s, t) => s + Number(t.monto), 0);
  const gastosSemana = txR.filter(t => t.fecha >= lunesStr && isGastoTx(t)).reduce((s, t) => s + Number(t.monto), 0);
  const gastosMesActSum = txR.filter(t => isGastoTx(t)).reduce((s, t) => s + Number(t.monto), 0);
  const promedioDiarioMes = diaActual > 0 ? gastosMesActSum / diaActual : 0;
  const txHoyList = txR.filter(t => t.fecha === hoyStr);
  const cantHoy = txHoyList.length;
  const txAyerCount = txR.filter(t => t.fecha === ayerStr).length;

  // ===== "ASÍ SE VE TU DINERO" — tabla por tipo (mes) =====
  const resumenPorTipo = CATEGORIA_TIPOS.map(t => {
    const real = sumMesTipo(t.value);
    const pres = presM.filter(p => p.categorias?.tipo === t.value).reduce((s, p) => s + Number(p.monto_esperado), 0);
    return { tipo: t, real, pres, diff: pres - real };
  });

  // ===== Pie: gasto por TIPO (solo tipos de gasto + ahorro) =====
  const pieData = CATEGORIA_TIPOS
    .filter(t => t.value !== "ingreso")
    .map(t => ({ name: t.label, value: sumMesTipo(t.value) }))
    .filter(d => d.value > 0);

  // ===== Top categorías del mes (gastos) =====
  const gastosPorCat: Record<string, number> = {};
  for (const t of txM) {
    if (!t.categorias || t.categorias.tipo === "ingreso") continue;
    const k = t.categoria_id ?? "_sin_";
    gastosPorCat[k] = (gastosPorCat[k] ?? 0) + Number(t.monto);
  }
  const catById = Object.fromEntries((cats ?? []).map((c: any) => [c.id, c]));
  const topCategorias = Object.entries(gastosPorCat)
    .map(([id, total]) => ({ id, nombre: catById[id]?.nombre ?? "Sin categoría", total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // ===== Bar: gasto día a día del mes =====
  const gastoPorDia: Record<number, number> = {};
  for (let d = 1; d <= diasEnMes; d++) gastoPorDia[d] = 0;
  for (const t of txM) {
    if (!t.categorias || t.categorias.tipo === "ingreso") continue;
    const dia = Number(t.fecha.split("-")[2]);
    gastoPorDia[dia] = (gastoPorDia[dia] ?? 0) + Number(t.monto);
  }
  const dailyData = Object.entries(gastoPorDia).map(([dia, gasto]) => ({ dia: Number(dia), gasto }));

  // ===== Line anual: ingresos vs egresos por mes =====
  const anualData = Array.from({ length: 12 }, (_, i) => ({ mes: MES_NOMBRES[i], ingresos: 0, egresos: 0 }));
  for (const t of txA) {
    if (!t.categorias) continue;
    const mIdx = Number((t.fecha as string).split("-")[1]) - 1;
    const monto = Number(t.monto);
    if (t.categorias.tipo === "ingreso") anualData[mIdx].ingresos += monto;
    else if (TIPOS_GASTO.includes(t.categorias.tipo)) anualData[mIdx].egresos += monto;
  }

  // ===== Alertas =====
  const alertas: { tipo: "danger" | "warn" | "info"; msg: string }[] = [];
  if (capital < 0) alertas.push({ tipo: "danger", msg: `Capital total negativo: ${formatMoney(capital, espacio.moneda)}` });
  if (gastosMes > ingresosMes && ingresosMes > 0)
    alertas.push({ tipo: "warn", msg: `Este mes gastaste ${formatMoney(gastosMes - ingresosMes, espacio.moneda)} más de lo que ingresaste.` });
  if (pctGastoUsado !== null && pctGastoUsado > 100)
    alertas.push({ tipo: "warn", msg: `Excediste el presupuesto del mes en ${formatMoney(gastosMes - presGastoMes, espacio.moneda)} (${pctGastoUsado.toFixed(0)}%).` });
  // Categorías que se pasaron del presupuesto
  for (const p of presM) {
    if (!p.categorias || !TIPOS_GASTO.includes(p.categorias.tipo)) continue;
    const real = txM.filter(t => t.categoria_id === p.categoria_id).reduce((s, t) => s + Number(t.monto), 0);
    if (Number(p.monto_esperado) > 0 && real > Number(p.monto_esperado) * 1.1) {
      alertas.push({
        tipo: "warn",
        msg: `${p.categorias.nombre}: gastaste ${formatMoney(real - Number(p.monto_esperado), espacio.moneda)} más de lo presupuestado.`,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">{espacio.nombre} · {espacio.tipo === "personal" ? "Personal" : "Empresarial"}</p>
        </div>
        <div className="flex items-center gap-2">
          <MonthSelector ano={ano} mes={mes} />
          <Button asChild><Link href={`/e/${espacio.slug}/transacciones`}><Plus className="h-4 w-4 mr-1" /> Nueva</Link></Button>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="space-y-2.5">
          {alertas.slice(0, 4).map((a, i) => (
            <div key={i} className={cn(
              "flex items-start gap-3 rounded-lg border-2 bg-card p-4 text-base font-medium shadow-sm border-l-[6px]",
              a.tipo === "danger" ? "border-destructive text-destructive"
                : a.tipo === "warn" ? "border-warning text-foreground"
                : "border-primary text-foreground"
            )}>
              <div className={cn(
                "rounded-full p-1.5 shrink-0",
                a.tipo === "danger" ? "bg-destructive/15"
                  : a.tipo === "warn" ? "bg-warning/15"
                  : "bg-primary/15"
              )}>
                <AlertTriangle className={cn(
                  "h-5 w-5",
                  a.tipo === "danger" ? "text-destructive"
                    : a.tipo === "warn" ? "text-warning"
                    : "text-primary"
                )} />
              </div>
              <span className="pt-0.5">{a.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* Coach IA: saludo + análisis del día (solo personal) */}
      {espacio.tipo === "personal" && <CoachCard />}

      {/* Card "Hoy" — Próximas tareas (solo personal) */}
      {espacio.tipo === "personal" && tareasHoy.length > 0 && <TareasHoyCard tareas={tareasHoy} slug={espacio.slug} />}

      {/* KPIs grandes */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Ingresos del mes"
          value={formatMoney(ingresosMes, espacio.moneda)}
          subtitle={pctIngresoCumplido !== null ? `${pctIngresoCumplido.toFixed(0)}% del esperado (${formatMoney(presIngresoMes, espacio.moneda)})` : "Sin presupuesto"}
          icon={<ArrowUpRight />}
          color="success"
          progress={pctIngresoCumplido}
        />
        <KpiCard
          title="Gastos del mes"
          value={formatMoney(gastosMes, espacio.moneda)}
          subtitle={pctGastoUsado !== null ? `${pctGastoUsado.toFixed(0)}% del presupuesto (${formatMoney(presGastoMes, espacio.moneda)})` : "Sin presupuesto"}
          icon={<ArrowDownRight />}
          color={pctGastoUsado !== null && pctGastoUsado > 100 ? "destructive" : "primary"}
          progress={pctGastoUsado}
          progressDanger
        />
        <KpiCard
          title="Restante del mes"
          value={formatMoney(restante, espacio.moneda)}
          subtitle={restante >= 0 ? "Te queda saldo" : "Vas en negativo"}
          icon={restante >= 0 ? <TrendingUp /> : <TrendingDown />}
          color={restante >= 0 ? "success" : "destructive"}
        />
        <KpiCard
          title="Capital total"
          value={formatMoney(capital, espacio.moneda)}
          subtitle="Todo lo registrado hasta hoy"
          icon={<Wallet />}
          color={capital >= 0 ? "primary" : "destructive"}
        />
      </div>

      {/* Hoy y los últimos días — siempre con datos actuales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Hoy y los últimos días
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniKpi
              label="Hoy"
              value={formatMoney(gastosHoy, espacio.moneda)}
              sub={cantHoy === 0 ? "Sin gastos" : `${cantHoy} ${cantHoy === 1 ? "transacción" : "transacciones"}`}
              highlight={promedioDiarioMes > 0 && gastosHoy > promedioDiarioMes * 1.2}
            />
            <MiniKpi
              label="Ayer"
              value={formatMoney(gastosAyer, espacio.moneda)}
              sub={txAyerCount === 0 ? "Sin gastos" : `${txAyerCount} ${txAyerCount === 1 ? "transacción" : "transacciones"}`}
            />
            <MiniKpi
              label="Esta semana"
              value={formatMoney(gastosSemana, espacio.moneda)}
              sub={`Desde el lunes`}
            />
            <MiniKpi
              label="Promedio diario"
              value={formatMoney(promedioDiarioMes, espacio.moneda)}
              sub="Mes en curso"
            />
          </div>

          {txHoyList.length > 0 ? (
            <div className="border-t pt-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Transacciones de hoy</div>
              <ul className="divide-y">
                {txHoyList.map((t) => {
                  const isGasto = t.categorias && t.categorias.tipo !== "ingreso";
                  const tInfo = t.categorias ? CATEGORIA_TIPOS.find((x) => x.value === t.categorias!.tipo) : null;
                  return (
                    <li key={t.id} className="py-2 flex justify-between items-center gap-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{t.categorias?.nombre ?? t.descripcion ?? "Sin categoría"}</p>
                        {t.descripcion && t.categorias?.nombre !== t.descripcion && (
                          <p className="text-xs text-muted-foreground truncate">{tInfo?.emoji} {t.descripcion}</p>
                        )}
                      </div>
                      <span className={cn("tabular-nums font-medium shrink-0", isGasto ? "text-destructive" : "text-success")}>
                        {isGasto ? "-" : "+"}{formatMoney(Number(t.monto), espacio.moneda)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <div className="border-t pt-3 text-sm text-muted-foreground">
              Aún no has registrado nada hoy. <Link href={`/e/${espacio.slug}/transacciones`} className="text-primary underline">Registra una transacción</Link>.
            </div>
          )}
        </CardContent>
      </Card>

      {/* "Así se ve tu dinero" — tabla por tipo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Así se ve tu dinero — {MES_NOMBRES[mes - 1]} {ano}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground font-medium pb-2 border-b">
              <span className="col-span-4">Categoría</span>
              <span className="col-span-2 text-right">Presupuesto</span>
              <span className="col-span-2 text-right">Real</span>
              <span className="col-span-2 text-right">Diferencia</span>
              <span className="col-span-2">% usado</span>
            </div>
            {resumenPorTipo.map(({ tipo, real, pres, diff }) => {
              const tienePres = pres > 0;
              const pct = tienePres ? (real / pres) * 100 : 0;
              const isIngreso = tipo.value === "ingreso";
              const cumple = isIngreso ? real >= pres : real <= pres;
              return (
                <div key={tipo.value} className="grid grid-cols-12 gap-2 text-sm items-center">
                  <span className="col-span-4 flex items-center gap-2">
                    <span>{tipo.emoji}</span>
                    <span className="font-medium">{tipo.label}</span>
                  </span>
                  <span className="col-span-2 text-right tabular-nums text-muted-foreground">{formatMoney(pres, espacio.moneda)}</span>
                  <span className="col-span-2 text-right tabular-nums font-medium">{formatMoney(real, espacio.moneda)}</span>
                  <span className={cn("col-span-2 text-right tabular-nums text-xs", cumple ? "text-success" : "text-destructive")}>
                    {diff >= 0 ? "+" : ""}{formatMoney(diff, espacio.moneda)}
                  </span>
                  <div className="col-span-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded bg-muted overflow-hidden">
                      <div className={cn("h-full transition-all", isIngreso ? "bg-success" : pct > 100 ? "bg-destructive" : pct > 80 ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{tienePres ? `${pct.toFixed(0)}%` : "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Gráficos: pie + top categorías */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>¿A dónde fue tu dinero?</CardTitle></CardHeader>
          <CardContent>
            <PieGastoPorTipo data={pieData} currency={espacio.moneda} />
            <div className="mt-2"><PieLegend data={pieData} currency={espacio.moneda} /></div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Top categorías donde más gastaste</CardTitle></CardHeader>
          <CardContent>
            <BarTopCategorias data={topCategorias} currency={espacio.moneda} />
          </CardContent>
        </Card>
      </div>

      {/* Gasto día a día */}
      <Card>
        <CardHeader><CardTitle>¿Cuándo gastaste tu dinero? · {MES_NOMBRES[mes - 1]}</CardTitle></CardHeader>
        <CardContent>
          <BarGastoDiario data={dailyData} currency={espacio.moneda} />
        </CardContent>
      </Card>

      {/* Vista anual */}
      <Card>
        <CardHeader><CardTitle>Ingresos vs Egresos · {ano}</CardTitle></CardHeader>
        <CardContent>
          <LineAnualIngresoEgreso data={anualData} currency={espacio.moneda} />
        </CardContent>
      </Card>

      {/* Últimas transacciones del mes */}
      <Card>
        <CardHeader><CardTitle>Transacciones de {MES_NOMBRES[mes - 1]}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {txM.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">Sin transacciones este mes. <Link href={`/e/${espacio.slug}/transacciones`} className="underline text-primary">Registra una</Link>.</p>
          ) : (
            <ul className="divide-y max-h-96 overflow-y-auto">
              {txM.map((t) => {
                const isGasto = t.categorias && t.categorias.tipo !== "ingreso";
                const tInfo = t.categorias ? CATEGORIA_TIPOS.find((x) => x.value === t.categorias!.tipo) : null;
                return (
                  <li key={t.id} className="py-3 px-6 flex justify-between items-center gap-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{t.categorias?.nombre ?? t.descripcion ?? "Sin categoría"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {tInfo?.emoji} {relativeDate(t.fecha)} {t.descripcion && t.categorias?.nombre !== t.descripcion ? `· ${t.descripcion}` : ""}
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

function TareasHoyCard({ tareas, slug }: { tareas: Tarea[]; slug: string }) {
  const ahora = new Date();
  const horaActual = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}:00`;

  const completadas = tareas.filter(t => t.completada).length;
  const totales = tareas.length;
  const pct = totales > 0 ? (completadas / totales) * 100 : 0;

  // Próxima tarea = primera no completada con hora_inicio >= ahora
  const proxima = tareas.find(t => !t.completada && t.hora_inicio && t.hora_inicio >= horaActual);
  // Atrasadas = no completadas con hora_inicio < ahora
  const atrasadas = tareas.filter(t => !t.completada && t.hora_inicio && t.hora_inicio < horaActual);
  // Sin hora pendientes
  const sinHoraPend = tareas.filter(t => !t.completada && !t.hora_inicio);

  // Mensaje motivacional simple
  let mensaje = "";
  if (totales === 0) mensaje = "Día libre. ¿Sin nada planeado?";
  else if (pct === 100) mensaje = "🎉 Día redondo. Te lo ganaste.";
  else if (atrasadas.length >= 3) mensaje = `⚠️ Llevas ${atrasadas.length} tareas atrasadas. Recupera o muévelas.`;
  else if (atrasadas.length === 1) mensaje = `Llevas tarde con ${atrasadas[0].titulo}. ¿La haces o la mueves?`;
  else if (completadas >= 3) mensaje = `🔥 Vas en racha — ${completadas} ya hechas.`;
  else if (completadas >= 1) mensaje = `Bien — ${completadas} hecha${completadas > 1 ? "s" : ""}, sigue.`;
  else mensaje = "Hoy es para empezar fuerte. Marca la primera.";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> Hoy</CardTitle>
          <Link href={`/e/${slug}/planeacion`} className="text-xs text-muted-foreground hover:text-primary">Ver semana →</Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progreso del día */}
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full transition-all", pct === 100 ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm tabular-nums font-medium">{completadas}/{totales}</span>
        </div>

        <p className="text-sm">{mensaje}</p>

        {/* Próxima tarea grande */}
        {proxima && (
          <div className="rounded-md border bg-primary/5 border-primary/30 p-3">
            <div className="text-[10px] uppercase tracking-wide text-primary font-semibold mb-1">Próxima</div>
            <div className="font-semibold text-sm">{TAREA_TIPOS.find(t => t.value === proxima.tipo)?.emoji} {proxima.titulo}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{formatHora(proxima.hora_inicio)} · {proxima.duracion_min}min</div>
          </div>
        )}

        {/* Atrasadas */}
        {atrasadas.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-destructive font-semibold">Atrasadas ({atrasadas.length})</p>
            {atrasadas.slice(0, 3).map(t => (
              <div key={t.id} className="text-xs flex items-center gap-2 text-muted-foreground">
                <span className="text-destructive">●</span>
                <span className="line-clamp-1 flex-1">{t.titulo}</span>
                <span className="tabular-nums shrink-0">{formatHora(t.hora_inicio)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Sin hora pendientes */}
        {sinHoraPend.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Por hacer (sin hora)</p>
            {sinHoraPend.slice(0, 3).map(t => (
              <div key={t.id} className="text-xs flex items-center gap-2 text-muted-foreground">
                <span>○</span>
                <span className="line-clamp-1 flex-1">{TAREA_TIPOS.find(x => x.value === t.tipo)?.emoji} {t.titulo}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KpiCard({ title, value, subtitle, icon, color, progress, progressDanger }: {
  title: string; value: string; subtitle?: string; icon: React.ReactNode;
  color: "success" | "destructive" | "primary"; progress?: number | null; progressDanger?: boolean;
}) {
  const colorClass =
    color === "success" ? "text-success" :
    color === "destructive" ? "text-destructive" :
    "text-primary";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("h-4 w-4", colorClass)}>{icon}</div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className={cn("text-2xl font-bold tabular-nums", colorClass)}>{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        {progress !== null && progress !== undefined && (
          <div className="h-1.5 rounded bg-muted overflow-hidden">
            <div className={cn("h-full transition-all",
              progressDanger && progress > 100 ? "bg-destructive" :
              progressDanger && progress > 80 ? "bg-warning" :
              "bg-primary"
            )} style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniKpi({ label, value, sub, highlight }: {
  label: string; value: string; sub?: string; highlight?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-lg border bg-card p-3 transition",
      highlight && "border-warning/60 bg-warning/5"
    )}>
      <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className={cn(
        "text-xl font-bold tabular-nums mt-1",
        highlight ? "text-warning" : "text-foreground"
      )}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
