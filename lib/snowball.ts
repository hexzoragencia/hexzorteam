// Algoritmo de bola de nieve (debt snowball):
// 1. Pagar la cuota mínima de TODAS las deudas
// 2. Aplicar el "pago extra" a la deuda con MENOR balance primero
// 3. Cuando una deuda se cierra, su cuota mínima + el pago extra rueda a la siguiente

import type { Deuda } from "./types";

export interface DeudaSimulada {
  id: string;
  nombre: string;
  balance: number;
  interes_anual: number;
  cuota_mensual: number;
}

export interface MesProyeccion {
  mes: number;          // 1, 2, 3...
  fecha: string;        // YYYY-MM-DD
  balanceTotal: number; // suma de balances al final del mes
  porDeuda: { id: string; nombre: string; balance: number; pagoIntereses: number; pagoCapital: number; pagoTotal: number; cerrada: boolean }[];
}

export interface DeudaImpagable {
  id: string;
  nombre: string;
  cuota_mensual: number;
  interes_mensual: number; // interés del primer mes
}

export interface ResultadoSnowball {
  proyeccion: MesProyeccion[];
  resumenPorDeuda: {
    id: string;
    nombre: string;
    balance: number;
    cuota_mensual: number;
    interes_anual: number;
    interesesTotales: number;
    mesesParaCero: number;
    fechaCero: string;
  }[];
  totales: {
    balance: number;
    cuotaMensual: number;
    interesesTotales: number;
    mesesParaTodas: number;
    fechaLibertad: string;
    truncada: boolean;       // true si se llegó a maxMeses sin terminar
  };
  impagables: DeudaImpagable[]; // cuotas que no cubren ni el interés
}

// Convierte tasa Efectiva Anual a tasa mensual equivalente (capitalización compuesta)
// EA 24% → 1.81% mensual, NO 2%
function eaAMensual(ea: number): number {
  return Math.pow(1 + ea, 1 / 12) - 1;
}

export function simularSnowball(
  deudas: DeudaSimulada[],
  fechaInicio: Date,
  pagoExtraInicial = 0,
  pagoExtraMensual = 0,
  maxMeses = 600,
): ResultadoSnowball {
  // Normalizar fecha al día 1 para evitar bugs de meses con menos días (ej: 31-Ene → Mar)
  const fechaBase = new Date(Date.UTC(fechaInicio.getUTCFullYear(), fechaInicio.getUTCMonth(), 1));

  // Detectar deudas impagables: la cuota mensual no cubre ni siquiera el primer interés
  const impagables: DeudaImpagable[] = [];
  for (const d of deudas) {
    if (d.balance > 0 && d.cuota_mensual > 0) {
      const interesMes1 = d.balance * eaAMensual(d.interes_anual);
      if (d.cuota_mensual <= interesMes1) {
        impagables.push({ id: d.id, nombre: d.nombre, cuota_mensual: d.cuota_mensual, interes_mensual: interesMes1 });
      }
    }
  }

  // Trabajamos con copias mutables. Excluimos impagables para que no rompan la simulación.
  const idsImpagables = new Set(impagables.map(d => d.id));
  const sim = deudas
    .filter(d => d.balance > 0 && d.cuota_mensual > 0 && !idsImpagables.has(d.id))
    .map(d => ({ ...d, balanceActual: Number(d.balance), interesesAcum: 0, mesCero: 0 }));

  const proyeccion: MesProyeccion[] = [];
  let extraDisponible = pagoExtraInicial;
  let truncada = false;

  for (let mes = 1; mes <= maxMeses; mes++) {
    const fecha = new Date(Date.UTC(fechaBase.getUTCFullYear(), fechaBase.getUTCMonth() + (mes - 1), 1));
    const fechaIso = fecha.toISOString().slice(0, 10);

    const extraEsteMes = extraDisponible + pagoExtraMensual;
    extraDisponible = 0;
    let cuotaLiberada = 0;
    const porDeuda: MesProyeccion["porDeuda"] = [];

    // Re-ordenar deudas activas por balance ASC cada mes (deuda más pequeña primero)
    const activas = sim.filter(d => d.balanceActual > 0).sort((a, b) => a.balanceActual - b.balanceActual);

    let extraAplicar = extraEsteMes;
    for (const d of activas) {
      // Interés del periodo (sobre saldo actual al inicio del mes)
      const tasaMensual = eaAMensual(d.interes_anual);
      const interesMes = d.balanceActual * tasaMensual;
      d.interesesAcum += interesMes;

      // Pago: cuota mínima (+ extra si es la primera activa)
      let pagoTotal = d.cuota_mensual;
      if (extraAplicar > 0) {
        pagoTotal += extraAplicar;
        extraAplicar = 0;
      }
      // No pagar más de balance + interés del mes
      pagoTotal = Math.min(pagoTotal, d.balanceActual + interesMes);

      // Aplicar: balance += interés − pago (split correcto entre intereses y capital)
      const pagoIntereses = Math.min(pagoTotal, interesMes);
      const pagoCapital = pagoTotal - pagoIntereses;
      d.balanceActual = d.balanceActual + interesMes - pagoTotal;

      const cerrada = d.balanceActual <= 0.01;
      if (cerrada) {
        d.balanceActual = 0;
        d.mesCero = mes;
        cuotaLiberada += d.cuota_mensual;
      }
      porDeuda.push({
        id: d.id, nombre: d.nombre, balance: d.balanceActual,
        pagoIntereses, pagoCapital, pagoTotal, cerrada,
      });
    }

    // Las deudas no activas (ya cerradas o impagables) se reportan con balance estable para el chart
    for (const d of sim) {
      if (d.balanceActual === 0 && !porDeuda.find(p => p.id === d.id)) {
        porDeuda.push({ id: d.id, nombre: d.nombre, balance: 0, pagoIntereses: 0, pagoCapital: 0, pagoTotal: 0, cerrada: true });
      }
    }

    extraDisponible += cuotaLiberada;
    const balanceTotal = sim.reduce((s, d) => s + d.balanceActual, 0);
    proyeccion.push({ mes, fecha: fechaIso, balanceTotal, porDeuda });

    if (balanceTotal < 0.01) break;
    if (mes === maxMeses) truncada = true;
  }

  const resumenPorDeuda = sim.map(d => {
    const fecha = new Date(Date.UTC(fechaBase.getUTCFullYear(), fechaBase.getUTCMonth() + (d.mesCero - 1), 1));
    return {
      id: d.id,
      nombre: d.nombre,
      balance: Number(d.balance),
      cuota_mensual: d.cuota_mensual,
      interes_anual: d.interes_anual,
      interesesTotales: d.interesesAcum,
      mesesParaCero: d.mesCero || -1,
      fechaCero: d.mesCero ? fecha.toISOString().slice(0, 10) : "—",
    };
  });

  const mesesParaTodas = proyeccion.length;
  const fechaLibertad = new Date(Date.UTC(fechaBase.getUTCFullYear(), fechaBase.getUTCMonth() + (mesesParaTodas - 1), 1));

  return {
    proyeccion,
    resumenPorDeuda,
    totales: {
      balance: deudas.reduce((s, d) => s + Number(d.balance), 0),
      cuotaMensual: deudas.reduce((s, d) => s + Number(d.cuota_mensual), 0),
      interesesTotales: resumenPorDeuda.reduce((s, d) => s + d.interesesTotales, 0),
      mesesParaTodas,
      fechaLibertad: fechaLibertad.toISOString().slice(0, 10),
      truncada,
    },
    impagables,
  };
}
