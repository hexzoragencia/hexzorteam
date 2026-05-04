// ============================================================
// EMPRESARIAL — Calculadora multipaís (Vasecom dropshipping)
// ============================================================
export type CountryCode = "CO" | "MX" | "EC" | "ES" | "CL";

export interface CountryConfig {
  code: CountryCode;
  nombre: string;
  bandera: string;
  moneda: string;
  flete_base: number;
  pct_entrega: number;
  pct_cpa_objetivo: number;
  pct_utilidad_objetivo: number;
  pct_comparacion: number;
}

export interface CalcResult {
  precio_proveedor: number;
  flete_base: number;
  flete_con_devoluciones: number;
  cpa_costeado: number;
  costos_totales: number;
  utilidad: number;
  precio_venta: number;
  precio_comparacion: number;
  margen_pct: number;
}

// ============================================================
// FINANCIERO — Espacios (workspaces) y modelo presupuestal
// ============================================================
export type EspacioTipo = "empresarial" | "personal";
export type RolMiembro = "owner" | "miembro" | "viewer";

export interface Espacio {
  id: string;
  slug: string;
  nombre: string;
  tipo: EspacioTipo;
  moneda: string;
  pin_hash: string | null;
  created_by: string | null;
  created_at: string;
}

export interface EspacioMiembro {
  espacio_id: string;
  perfil_id: string;
  rol: RolMiembro;
}

// Tipos de categoría — los 6 del Excel
export type CategoriaTipo =
  | "ingreso"
  | "pago_programado"
  | "suscripcion"
  | "gasto_mensual"
  | "ahorro"
  | "deuda";

export const CATEGORIA_TIPOS: { value: CategoriaTipo; label: string; emoji: string; color: string }[] = [
  { value: "ingreso",          label: "Ingreso",            emoji: "💰", color: "text-success" },
  { value: "pago_programado",  label: "Pago programado",    emoji: "📆", color: "text-blue-500" },
  { value: "suscripcion",      label: "Suscripción",        emoji: "🔄", color: "text-purple-500" },
  { value: "gasto_mensual",    label: "Gasto mensual",      emoji: "🧾", color: "text-orange-500" },
  { value: "ahorro",           label: "Ahorro",             emoji: "🐷", color: "text-emerald-500" },
  { value: "deuda",            label: "Deuda",              emoji: "💳", color: "text-destructive" },
];

export interface Categoria {
  id: string;
  espacio_id: string;
  tipo: CategoriaTipo;
  nombre: string;
  orden: number;
  activo: boolean;
  created_at: string;
}

export interface PresupuestoMensual {
  id: string;
  categoria_id: string;
  ano: number;
  mes: number;
  monto_esperado: number;
  fecha_esperada: string | null;
}

export interface Transaccion {
  id: string;
  espacio_id: string;
  categoria_id: string | null;
  fecha: string;
  monto: number;
  descripcion: string | null;
  responsable_id: string | null;
  created_at: string;
}

export interface FondoReserva {
  id: string;
  espacio_id: string;
  nombre: string;
  meta: number;
  pago_mensual: number;
  inicial: number;
  ahorrado: number;
  activo: boolean;
  created_at: string;
}

export interface Deuda {
  id: string;
  espacio_id: string;
  nombre: string;
  balance: number;
  interes_anual: number;
  cuota_mensual: number;
  orden: number;
  pagada: boolean;
  created_at: string;
}

export interface SnowballConfig {
  espacio_id: string;
  fecha_inicio: string;
  pago_extra_inicial: number;
  pago_extra_mensual: number;
}

// ============================================================
// PRODUCTIVIDAD — Hábitos
// ============================================================
export interface Habito {
  id: string;
  espacio_id: string;
  nombre: string;
  emoji: string;
  color: string;
  frecuencia_semanal: number; // 1-7 (días por semana esperados)
  orden: number;
  archivado: boolean;
  created_at: string;
}

export interface HabitoMarca {
  habito_id: string;
  fecha: string; // YYYY-MM-DD
}

// ============================================================
// PRODUCTIVIDAD — Objetivos
// ============================================================
export type ObjetivoTipo = "financiero" | "proyecto" | "personal";
export type ObjetivoEstado = "backlog" | "en_progreso" | "completado" | "pausado" | "cancelado";

export const OBJETIVO_TIPOS: { value: ObjetivoTipo; label: string; emoji: string }[] = [
  { value: "financiero", label: "Financiero", emoji: "💰" },
  { value: "proyecto",   label: "Proyecto",   emoji: "🚀" },
  { value: "personal",   label: "Personal",   emoji: "🌱" },
];

export const OBJETIVO_ESTADOS: { value: ObjetivoEstado; label: string; emoji: string; color: string }[] = [
  { value: "backlog",     label: "Backlog",     emoji: "📋", color: "text-muted-foreground" },
  { value: "en_progreso", label: "En progreso", emoji: "⏳", color: "text-blue-500" },
  { value: "completado",  label: "Completado",  emoji: "✅", color: "text-success" },
  { value: "pausado",     label: "Pausado",     emoji: "⏸️", color: "text-orange-500" },
  { value: "cancelado",   label: "Cancelado",   emoji: "❌", color: "text-destructive" },
];

export interface Objetivo {
  id: string;
  espacio_id: string;
  titulo: string;
  descripcion: string | null;
  tipo: ObjetivoTipo;
  estado: ObjetivoEstado;
  ingreso_esperado: number | null;
  ganancia_esperada: number | null;
  cantidad: number;
  progreso: number;
  fecha_limite: string | null;
  orden: number;
  created_at: string;
  completado_at: string | null;
}

export interface ObjetivoSubtarea {
  id: string;
  objetivo_id: string;
  titulo: string;
  completada: boolean;
  orden: number;
  created_at: string;
}

// ============================================================
// PRODUCTIVIDAD — Planeación diaria + Pomodoro
// ============================================================
export type TareaTipo = "tarea" | "reunion" | "bloqueo" | "personal";

export const TAREA_TIPOS: { value: TareaTipo; label: string; emoji: string; bg: string; border: string; text: string }[] = [
  { value: "tarea",    label: "Tarea",    emoji: "✓",  bg: "bg-blue-500/15",     border: "border-blue-500/40",     text: "text-blue-700 dark:text-blue-300" },
  { value: "reunion",  label: "Reunión",  emoji: "👥", bg: "bg-purple-500/15",   border: "border-purple-500/40",   text: "text-purple-700 dark:text-purple-300" },
  { value: "bloqueo",  label: "Bloqueo",  emoji: "🔒", bg: "bg-orange-500/15",   border: "border-orange-500/40",   text: "text-orange-700 dark:text-orange-300" },
  { value: "personal", label: "Personal", emoji: "🌱", bg: "bg-emerald-500/15",  border: "border-emerald-500/40",  text: "text-emerald-700 dark:text-emerald-300" },
];

export interface Tarea {
  id: string;
  espacio_id: string;
  objetivo_id: string | null;
  titulo: string;
  descripcion: string | null;
  fecha: string;          // YYYY-MM-DD
  hora_inicio: string | null;  // HH:MM:SS
  duracion_min: number;
  tipo: TareaTipo;
  notas: string | null;
  completada: boolean;
  completada_at: string | null;
  orden: number;
  created_at: string;
}

export interface PomodoroSesion {
  id: string;
  espacio_id: string;
  tarea_id: string | null;
  inicio: string;
  fin: string | null;
  duracion_planeada_min: number;
  duracion_real_min: number | null;
  tipo: "trabajo" | "descanso";
  completada: boolean;
  created_at: string;
}
