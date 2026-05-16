import type { CalcResult, CountryConfig } from "./types";

export function calcularPrecio(
  precioProveedor: number,
  cfg: CountryConfig
): CalcResult {
  const fleteConDevoluciones = cfg.pct_entrega > 0 ? cfg.flete_base / cfg.pct_entrega : 0;

  const baseSinCpa = precioProveedor + fleteConDevoluciones;
  const denom = 1 - cfg.pct_cpa_objetivo - cfg.pct_utilidad_objetivo;
  const costosTotales = denom > 0 ? baseSinCpa / denom : 0;

  const cpaCosteado = costosTotales * cfg.pct_cpa_objetivo;
  const utilidad = costosTotales * cfg.pct_utilidad_objetivo;
  const precioVenta = costosTotales + utilidad;
  const precioComparacion = precioVenta * (1 + cfg.pct_comparacion);
  const margenPct = precioVenta > 0 ? utilidad / precioVenta : 0;

  // ===== OFERTAS DE CANTIDAD (combos x2 / x3) =====
  // Regla del Excel OPTIMUX:
  //   Precio 2und = Precio 1und + Utilidad objetivo + Costo del producto
  //   Precio 3und = Precio 2und + Utilidad objetivo + Costo del producto
  // Cada unidad extra solo añade el costo del producto + la utilidad que se
  // quiere ganar por esa unidad. NO suma flete/CPA/admin porque es el MISMO
  // envío y la MISMA venta (1 sola pauta). Redondeado a la centena.
  const redondearCentena = (n: number) => Math.round(n / 100) * 100;

  const precio2und = redondearCentena(precioVenta + utilidad + precioProveedor);
  const precio3und = redondearCentena(precio2und + utilidad + precioProveedor);
  const utilidad2und = utilidad * 2;
  const utilidad3und = utilidad * 3;

  return {
    precio_proveedor: precioProveedor,
    flete_base: cfg.flete_base,
    flete_con_devoluciones: fleteConDevoluciones,
    cpa_costeado: cpaCosteado,
    costos_totales: costosTotales,
    utilidad,
    precio_venta: precioVenta,
    precio_comparacion: precioComparacion,
    margen_pct: margenPct,
    precio_2und: precio2und,
    utilidad_2und: utilidad2und,
    margen_2und: precio2und > 0 ? utilidad2und / precio2und : 0,
    precio_3und: precio3und,
    utilidad_3und: utilidad3und,
    margen_3und: precio3und > 0 ? utilidad3und / precio3und : 0,
  };
}

export const DEFAULT_COUNTRIES: CountryConfig[] = [
  { code: "CO", nombre: "Colombia",  bandera: "🇨🇴", moneda: "COP", flete_base: 18500, pct_entrega: 0.65, pct_cpa_objetivo: 0.55, pct_utilidad_objetivo: 0.20, pct_comparacion: 1.0 },
  { code: "MX", nombre: "México",    bandera: "🇲🇽", moneda: "MXN", flete_base: 145,   pct_entrega: 0.65, pct_cpa_objetivo: 0.55, pct_utilidad_objetivo: 0.10, pct_comparacion: 0.66 },
  { code: "EC", nombre: "Ecuador",   bandera: "🇪🇨", moneda: "USD", flete_base: 7,     pct_entrega: 0.70, pct_cpa_objetivo: 0.60, pct_utilidad_objetivo: 0.10, pct_comparacion: 0.66 },
  { code: "ES", nombre: "España",    bandera: "🇪🇸", moneda: "EUR", flete_base: 5,     pct_entrega: 0.65, pct_cpa_objetivo: 0.55, pct_utilidad_objetivo: 0.10, pct_comparacion: 0.66 },
  { code: "CL", nombre: "Chile",     bandera: "🇨🇱", moneda: "CLP", flete_base: 6500,  pct_entrega: 0.70, pct_cpa_objetivo: 0.60, pct_utilidad_objetivo: 0.30, pct_comparacion: 0.66 },
];
