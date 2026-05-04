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
