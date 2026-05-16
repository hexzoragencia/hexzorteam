// Lógica compartida para registrar una campaña diaria.
// La usan: el formulario manual (vía /api/campanas/registrar) y el Coach IA.
// Hace 3 cosas: 1) inserta la campaña, 2) suma las ventas al tracking de
// Proyección, 3) registra el gasto de pauta como gasto real en Contabilidad.

type SB = any;

export type DatosCampana = {
  producto_id?: string | null;
  fecha: string; // YYYY-MM-DD
  nombre_campana?: string;
  num_ventas?: number;
  precio_venta?: number | null;
  costo_proveedor?: number | null;
  costo_pauta_fb?: number;
  costo_pauta_tk?: number;
  flete_devolucion?: number;
  efectividad_pct?: number | null; // si no viene, se toma de emp_metas
  observacion?: string | null;
};

export async function registrarCampana(sb: SB, espacioId: string, d: DatosCampana) {
  const avisos: string[] = [];

  // 1) Efectividad: si no la dan, usar la de Proyección (pct_conf × pct_entrega)
  let efectividad = d.efectividad_pct ?? null;
  if (efectividad == null) {
    const { data: m } = await sb.from("emp_metas")
      .select("pct_confirmacion, pct_entrega").eq("espacio_id", espacioId).maybeSingle();
    if (m) {
      efectividad = Number(m.pct_confirmacion ?? 0.8) * Number(m.pct_entrega ?? 0.8);
    } else {
      efectividad = 0.65;
      avisos.push("usé 65% de efectividad por defecto (configura Proyección para afinarlo)");
    }
  }

  const pautaFb = Number(d.costo_pauta_fb ?? 0);
  const pautaTk = Number(d.costo_pauta_tk ?? 0);
  const totalPauta = pautaFb + pautaTk;
  const numVentas = Math.max(0, Math.floor(Number(d.num_ventas ?? 0)));

  // 2) Insertar la campaña
  const { data: campana, error: errC } = await sb.from("emp_campanas").insert({
    espacio_id: espacioId,
    producto_id: d.producto_id ?? null,
    fecha: d.fecha,
    nombre_campana: d.nombre_campana || "Testeo",
    efectividad_pct: efectividad,
    flete_devolucion: Number(d.flete_devolucion ?? 0),
    num_ventas: numVentas,
    precio_venta: d.precio_venta ?? null,
    costo_proveedor: d.costo_proveedor ?? null,
    costo_pauta_fb: pautaFb,
    costo_pauta_tk: pautaTk,
    observacion: d.observacion ?? null,
  }).select("id").single();
  if (errC) throw new Error(errC.message);

  // 3) Sumar las ventas al tracking de Proyección (mismo día)
  if (numVentas > 0) {
    const { data: tk } = await sb.from("emp_metas_tracking")
      .select("ventas_dia").eq("espacio_id", espacioId).eq("fecha", d.fecha).maybeSingle();
    const ventasPrev = Number(tk?.ventas_dia ?? 0);
    await sb.from("emp_metas_tracking").upsert({
      espacio_id: espacioId,
      fecha: d.fecha,
      ventas_dia: ventasPrev + numVentas,
    }, { onConflict: "espacio_id,fecha" });
    avisos.push(`sumé ${numVentas} ventas a Proyección`);
  }

  // 4) Registrar el gasto de pauta como gasto real en Contabilidad
  if (totalPauta > 0) {
    // Buscar (o crear) una categoría de gasto para la pauta
    const { data: cats } = await sb.from("categorias")
      .select("id, nombre, tipo").eq("espacio_id", espacioId).eq("tipo", "gasto_mensual");
    const buscar = (cats ?? []).find((c: any) =>
      /pauta|publicidad|ads|marketing|pubicidad/i.test(c.nombre));
    let categoriaId = buscar?.id ?? null;
    if (!categoriaId) {
      const { data: nueva } = await sb.from("categorias").insert({
        espacio_id: espacioId,
        tipo: "gasto_mensual",
        nombre: "Pauta / Publicidad",
      }).select("id").single();
      categoriaId = nueva?.id ?? null;
    }
    await sb.from("transacciones").insert({
      espacio_id: espacioId,
      categoria_id: categoriaId,
      fecha: d.fecha,
      monto: totalPauta,
      descripcion: `Pauta del día${d.nombre_campana ? ` · ${d.nombre_campana}` : ""}`,
    });
    avisos.push(`registré $${totalPauta.toLocaleString("es-CO")} de pauta como gasto`);
  }

  return { campanaId: campana?.id as string, efectividad, totalPauta, numVentas, avisos };
}
