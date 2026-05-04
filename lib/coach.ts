// Helpers compartidos del Coach IA: recolección de contexto del usuario.

import type { SupabaseClient } from "@supabase/supabase-js";
import { hoyIso, sumarDias, lunesDe } from "@/lib/fechas";

export interface ContextoUsuario {
  fecha: string;
  diaSemana: string;
  tareasHoyTotal: number;
  tareasHoyHechas: number;
  tareasHoyAtrasadas: number;
  tareasMananaTotal: number;
  habitosMesPctGlobal: number;
  habitoMejor: string | null;
  habitoPeor: string | null;
  rachaActualDias: number;
  finanzas: {
    ingresosMes: number;
    gastosMes: number;
    presupuestoMes: number;
    pctPresupuestoUsado: number | null;
    topCategoria: string | null;
    topCategoriaTotal: number;
    capitalNegativo: boolean;
  };
  objetivos: {
    enProgreso: number;
    completados: number;
    proximaFechaLimite: { titulo: string; fecha: string } | null;
  };
  deudas: {
    total: number;
    cuotaMensual: number;
  };
}

const DIAS = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

export async function recolectarContexto(sb: SupabaseClient, espacioId: string): Promise<ContextoUsuario> {
  const hoy = hoyIso();
  const ahora = new Date();
  const horaActual = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}:00`;
  const inicioMes = hoy.slice(0, 7) + "-01";
  const inicioMesAno = Number(hoy.slice(0, 4));
  const inicioMesNum = Number(hoy.slice(5, 7));
  const finMes = inicioMesNum === 12
    ? `${inicioMesAno + 1}-01-01`
    : `${inicioMesAno}-${String(inicioMesNum + 1).padStart(2, "0")}-01`;
  const lunes = lunesDe(hoy);
  const finSemana = sumarDias(lunes, 7);

  // ===== TAREAS =====
  let tareasHoy: any[] = [];
  let tareasManana: any[] = [];
  try {
    const [{ data: th }, { data: tm }] = await Promise.all([
      sb.from("tareas").select("*").eq("espacio_id", espacioId).eq("fecha", hoy),
      sb.from("tareas").select("id").eq("espacio_id", espacioId).eq("fecha", sumarDias(hoy, 1)),
    ]);
    tareasHoy = th ?? [];
    tareasManana = tm ?? [];
  } catch { /* tabla no existe */ }
  const tareasHoyHechas = tareasHoy.filter(t => t.completada).length;
  const tareasHoyAtrasadas = tareasHoy.filter(t => !t.completada && t.hora_inicio && t.hora_inicio < horaActual).length;

  // ===== HÁBITOS DEL MES =====
  let habitos: any[] = [];
  let marcas: any[] = [];
  try {
    const { data: h } = await sb.from("habitos").select("*").eq("espacio_id", espacioId).eq("archivado", false);
    habitos = h ?? [];
    if (habitos.length > 0) {
      const { data: m } = await sb.from("habito_marcas")
        .select("habito_id, fecha")
        .in("habito_id", habitos.map((x: any) => x.id))
        .gte("fecha", inicioMes);
      marcas = m ?? [];
    }
  } catch { /* tabla no existe */ }
  const diasMes = new Date(inicioMesAno, inicioMesNum, 0).getDate();
  const totalEsperadoHabitos = habitos.length * diasMes;
  const habitosMesPctGlobal = totalEsperadoHabitos > 0 ? (marcas.length / totalEsperadoHabitos) * 100 : 0;
  const porHabito = habitos.map((h: any) => {
    const c = marcas.filter((m: any) => m.habito_id === h.id).length;
    return { nombre: h.nombre, pct: diasMes > 0 ? (c / diasMes) * 100 : 0 };
  }).sort((a, b) => b.pct - a.pct);
  const habitoMejor = porHabito[0]?.pct > 0 ? porHabito[0].nombre : null;
  const habitoPeor = porHabito.length > 0 ? porHabito[porHabito.length - 1].nombre : null;

  // Racha actual: días consecutivos hacia atrás con TODOS los hábitos cumplidos
  let racha = 0;
  if (habitos.length > 0) {
    const idx: Record<string, Set<string>> = {};
    for (const m of marcas) (idx[m.habito_id] ??= new Set()).add(m.fecha);
    let cursor = new Date(hoy + "T00:00:00");
    while (racha < 365) {
      const iso = cursor.toISOString().slice(0, 10);
      const todas = habitos.every((h: any) => idx[h.id]?.has(iso));
      if (!todas) break;
      racha++;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  // ===== FINANZAS DEL MES =====
  const TIPOS_GASTO = ["pago_programado","suscripcion","gasto_mensual","deuda"];
  const { data: txMes } = await sb.from("transacciones")
    .select("monto, categoria_id, categorias(nombre, tipo)")
    .eq("espacio_id", espacioId)
    .gte("fecha", inicioMes).lt("fecha", finMes);
  const { data: presMes } = await sb.from("presupuestos_mensuales")
    .select("monto_esperado, categorias(espacio_id, tipo)")
    .eq("ano", inicioMesAno).eq("mes", inicioMesNum);

  const txList = (txMes ?? []) as any[];
  const presList = ((presMes ?? []) as any[]).filter(p => p.categorias?.espacio_id === espacioId);
  const ingresosMes = txList.filter(t => t.categorias?.tipo === "ingreso").reduce((s, t) => s + Number(t.monto), 0);
  const gastosMes = txList.filter(t => TIPOS_GASTO.includes(t.categorias?.tipo)).reduce((s, t) => s + Number(t.monto), 0);
  const presupuestoMes = presList.filter(p => TIPOS_GASTO.includes(p.categorias?.tipo)).reduce((s, p) => s + Number(p.monto_esperado), 0);
  const pctPresupuestoUsado = presupuestoMes > 0 ? (gastosMes / presupuestoMes) * 100 : null;

  const gastosPorCat: Record<string, number> = {};
  for (const t of txList) {
    if (TIPOS_GASTO.includes(t.categorias?.tipo)) {
      gastosPorCat[t.categorias?.nombre ?? "Sin categoría"] = (gastosPorCat[t.categorias?.nombre ?? "Sin categoría"] ?? 0) + Number(t.monto);
    }
  }
  const top = Object.entries(gastosPorCat).sort((a, b) => b[1] - a[1])[0];

  // Capital all-time (solo si ingresos < gastos del histórico, marcamos negativo)
  const { data: txAll } = await sb.from("transacciones").select("monto, categorias(tipo)").eq("espacio_id", espacioId);
  const txAllList = (txAll ?? []) as any[];
  const sumAll = (tipo: string) => txAllList.filter(t => t.categorias?.tipo === tipo).reduce((s, t) => s + Number(t.monto), 0);
  const capital = sumAll("ingreso") - TIPOS_GASTO.reduce((s, t) => s + sumAll(t), 0) - sumAll("ahorro");

  // ===== OBJETIVOS =====
  let objetivos: any[] = [];
  try {
    const { data } = await sb.from("objetivos").select("*").eq("espacio_id", espacioId);
    objetivos = data ?? [];
  } catch { /* tabla no existe */ }
  const enProgreso = objetivos.filter(o => o.estado === "en_progreso").length;
  const completados = objetivos.filter(o => o.estado === "completado").length;
  const conFecha = objetivos.filter(o => o.fecha_limite && o.estado === "en_progreso").sort((a, b) => a.fecha_limite!.localeCompare(b.fecha_limite!));
  const proximaFechaLimite = conFecha[0] ? { titulo: conFecha[0].titulo, fecha: conFecha[0].fecha_limite! } : null;

  // ===== DEUDAS =====
  const { data: deudas } = await sb.from("deudas").select("balance, cuota_mensual").eq("espacio_id", espacioId).eq("pagada", false);
  const deudasList = (deudas ?? []) as any[];
  const deudaTotal = deudasList.reduce((s, d) => s + Number(d.balance), 0);
  const deudaCuota = deudasList.reduce((s, d) => s + Number(d.cuota_mensual), 0);

  return {
    fecha: hoy,
    diaSemana: DIAS[ahora.getDay()],
    tareasHoyTotal: tareasHoy.length,
    tareasHoyHechas,
    tareasHoyAtrasadas,
    tareasMananaTotal: tareasManana.length,
    habitosMesPctGlobal,
    habitoMejor,
    habitoPeor,
    rachaActualDias: racha,
    finanzas: {
      ingresosMes, gastosMes, presupuestoMes, pctPresupuestoUsado,
      topCategoria: top?.[0] ?? null,
      topCategoriaTotal: top?.[1] ?? 0,
      capitalNegativo: capital < 0,
    },
    objetivos: { enProgreso, completados, proximaFechaLimite },
    deudas: { total: deudaTotal, cuotaMensual: deudaCuota },
  };
}
