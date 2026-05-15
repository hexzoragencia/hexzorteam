"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Target, Save, Calendar, TrendingUp, Plus, CheckCircle2,
  XCircle, Trash2, Calculator, ArrowDown, ArrowRight, Info, DollarSign,
  AlertTriangle, Trophy, Activity,
} from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";

type Meta = {
  id?: string; espacio_id?: string;
  meta_ventas_iniciales: number; pct_confirmacion: number; pct_entrega: number;
  meta_gastos_fijos: number; meta_ganancia: number;
  meta_ventas_diarias: number; meta_ventas_semanales: number; meta_ventas_mensuales: number;
  meta_productos_testeo_mes: number;
  utilidad_por_pedido: number;
  observacion: string | null;
};

type Tracking = {
  id: string; espacio_id: string; fecha: string;
  ventas_dia: number; productos_montados: number; observacion: string | null;
};

const META_DEFAULT: Meta = {
  meta_ventas_iniciales: 500,
  pct_confirmacion: 0.80,
  pct_entrega: 0.80,
  meta_gastos_fijos: 6400000,
  meta_ganancia: 20352000,
  meta_ventas_diarias: 53,
  meta_ventas_semanales: 371,
  meta_ventas_mensuales: 1590,
  meta_productos_testeo_mes: 25,
  utilidad_por_pedido: 25000,
  observacion: null,
};

const DIAS_MES = 30;
const DIAS_SEMANA = 7;

function hoyIso() {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(new Date());
}

// ¿Qué día del mes estamos? (1..30)
function diaDelMes(): number {
  const d = new Date();
  return d.getDate();
}
function diaDeSemana(): number {
  // 1 (lunes) .. 7 (domingo)
  const d = new Date();
  return ((d.getDay() + 6) % 7) + 1;
}

export function ProyeccionClient({ espacioId, moneda, meta: metaInicial, tracking: trackingInicial }: {
  espacioId: string; moneda: string;
  meta: Meta | null;
  tracking: Tracking[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [meta, setMeta] = useState<Meta>({ ...META_DEFAULT, ...(metaInicial ?? {}) });
  const [tracking, setTracking] = useState<Tracking[]>(trackingInicial);
  const [savingMeta, setSavingMeta] = useState(false);

  // Form para registrar día
  const [formFecha, setFormFecha] = useState(hoyIso());
  const [formVentas, setFormVentas] = useState<number | "">("");
  const [formProductos, setFormProductos] = useState<number | "">("");
  const [savingTrack, setSavingTrack] = useState(false);

  // Para evitar bucles infinitos al sincronizar campos
  const sincronizandoRef = useRef(false);

  // ====== STATS REALES (lo que has hecho) ======
  const stats = useMemo(() => {
    const hoy = hoyIso();
    const lunes = new Date(hoy + "T00:00:00");
    lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
    const lunesIso = lunes.toISOString().slice(0, 10);
    const inicioMes = hoy.slice(0, 7) + "-01";

    const tHoy = tracking.find(t => t.fecha === hoy);
    const tSem = tracking.filter(t => t.fecha >= lunesIso);
    const tMes = tracking.filter(t => t.fecha >= inicioMes);

    const ventasHoy = tHoy?.ventas_dia ?? 0;
    const ventasSem = tSem.reduce((s, t) => s + t.ventas_dia, 0);
    const ventasMes = tMes.reduce((s, t) => s + t.ventas_dia, 0);
    const productosMes = tMes.reduce((s, t) => s + t.productos_montados, 0);

    return { ventasHoy, ventasSem, ventasMes, productosMes };
  }, [tracking]);

  // ====== SEMÁFOROS ======
  // Esperado HOY si vienes constante = (día_del_mes / DIAS_MES) * meta_mensual
  const esperado = useMemo(() => {
    const diaMes = diaDelMes();
    const diaSem = diaDeSemana();
    const espMes = (diaMes / DIAS_MES) * meta.meta_ventas_mensuales;
    const espSem = (diaSem / DIAS_SEMANA) * meta.meta_ventas_semanales;
    return { mes: espMes, semana: espSem, dia: meta.meta_ventas_diarias };
  }, [meta]);

  function calcEstado(real: number, esperadoVal: number) {
    if (esperadoVal <= 0) return { label: "Sin meta", color: "text-muted-foreground", bg: "bg-muted/40", icon: Info };
    const pct = (real / esperadoVal) * 100;
    if (pct >= 100) return { label: "Cumpliendo 🎯", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/15", icon: Trophy, pct };
    if (pct >= 80)  return { label: "Cerca",        color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-500/15",   icon: Activity, pct };
    return                  { label: "Atrasado",     color: "text-rose-600 dark:text-rose-400",     bg: "bg-rose-500/15",     icon: AlertTriangle, pct };
  }

  const semaforos = useMemo(() => ({
    dia:    calcEstado(stats.ventasHoy, esperado.dia),
    semana: calcEstado(stats.ventasSem, esperado.semana),
    mes:    calcEstado(stats.ventasMes, esperado.mes),
    productos: calcEstado(stats.productosMes, meta.meta_productos_testeo_mes),
  }), [stats, esperado, meta.meta_productos_testeo_mes]);

  // ====== AUTO-CÁLCULOS ======
  // El usuario puede editar cualquier campo. Sincronizamos los relacionados.

  function actualizarMes(nuevoMes: number) {
    if (sincronizandoRef.current) return;
    sincronizandoRef.current = true;
    const semana = Math.round(nuevoMes / (DIAS_MES / DIAS_SEMANA));
    const dia = Math.round(nuevoMes / DIAS_MES);
    const ganancia = nuevoMes * (meta.pct_confirmacion) * (meta.pct_entrega) * meta.utilidad_por_pedido;
    setMeta({
      ...meta,
      meta_ventas_mensuales: nuevoMes,
      meta_ventas_semanales: semana,
      meta_ventas_diarias: dia,
      meta_ventas_iniciales: nuevoMes,
      meta_ganancia: Math.round(ganancia),
    });
    setTimeout(() => { sincronizandoRef.current = false; }, 0);
  }

  function actualizarSemana(nuevoSemana: number) {
    if (sincronizandoRef.current) return;
    sincronizandoRef.current = true;
    const mes = Math.round(nuevoSemana * (DIAS_MES / DIAS_SEMANA));
    const dia = Math.round(nuevoSemana / DIAS_SEMANA);
    const ganancia = mes * meta.pct_confirmacion * meta.pct_entrega * meta.utilidad_por_pedido;
    setMeta({
      ...meta,
      meta_ventas_semanales: nuevoSemana,
      meta_ventas_mensuales: mes,
      meta_ventas_diarias: dia,
      meta_ventas_iniciales: mes,
      meta_ganancia: Math.round(ganancia),
    });
    setTimeout(() => { sincronizandoRef.current = false; }, 0);
  }

  function actualizarDia(nuevoDia: number) {
    if (sincronizandoRef.current) return;
    sincronizandoRef.current = true;
    const semana = nuevoDia * DIAS_SEMANA;
    const mes = nuevoDia * DIAS_MES;
    const ganancia = mes * meta.pct_confirmacion * meta.pct_entrega * meta.utilidad_por_pedido;
    setMeta({
      ...meta,
      meta_ventas_diarias: nuevoDia,
      meta_ventas_semanales: semana,
      meta_ventas_mensuales: mes,
      meta_ventas_iniciales: mes,
      meta_ganancia: Math.round(ganancia),
    });
    setTimeout(() => { sincronizandoRef.current = false; }, 0);
  }

  // Reversa: pongo cuánto quiero ganar → calcula cuántas ventas necesito
  function actualizarGanancia(nuevaGanancia: number) {
    if (sincronizandoRef.current) return;
    sincronizandoRef.current = true;
    const factor = meta.pct_confirmacion * meta.pct_entrega * meta.utilidad_por_pedido;
    const mes = factor > 0 ? Math.ceil(nuevaGanancia / factor) : 0;
    const semana = Math.round(mes / (DIAS_MES / DIAS_SEMANA));
    const dia = Math.round(mes / DIAS_MES);
    setMeta({
      ...meta,
      meta_ganancia: nuevaGanancia,
      meta_ventas_mensuales: mes,
      meta_ventas_semanales: semana,
      meta_ventas_diarias: dia,
      meta_ventas_iniciales: mes,
    });
    setTimeout(() => { sincronizandoRef.current = false; }, 0);
  }

  function actualizarUtilidad(nuevaUtilidad: number) {
    if (sincronizandoRef.current) return;
    sincronizandoRef.current = true;
    const ganancia = meta.meta_ventas_mensuales * meta.pct_confirmacion * meta.pct_entrega * nuevaUtilidad;
    setMeta({
      ...meta,
      utilidad_por_pedido: nuevaUtilidad,
      meta_ganancia: Math.round(ganancia),
    });
    setTimeout(() => { sincronizandoRef.current = false; }, 0);
  }

  function actualizarConfirmacion(nuevoPct: number) {
    if (sincronizandoRef.current) return;
    sincronizandoRef.current = true;
    const ganancia = meta.meta_ventas_mensuales * nuevoPct * meta.pct_entrega * meta.utilidad_por_pedido;
    setMeta({ ...meta, pct_confirmacion: nuevoPct, meta_ganancia: Math.round(ganancia) });
    setTimeout(() => { sincronizandoRef.current = false; }, 0);
  }

  function actualizarEntrega(nuevoPct: number) {
    if (sincronizandoRef.current) return;
    sincronizandoRef.current = true;
    const ganancia = meta.meta_ventas_mensuales * meta.pct_confirmacion * nuevoPct * meta.utilidad_por_pedido;
    setMeta({ ...meta, pct_entrega: nuevoPct, meta_ganancia: Math.round(ganancia) });
    setTimeout(() => { sincronizandoRef.current = false; }, 0);
  }

  // ====== CÁLCULOS DERIVADOS (vista previa en vivo) ======
  const calc = useMemo(() => {
    const v = meta.meta_ventas_iniciales || meta.meta_ventas_mensuales;
    const conf = v * meta.pct_confirmacion;
    const entr = conf * meta.pct_entrega;
    const gananciaBruta = entr * meta.utilidad_por_pedido;
    const utilidadNeta = gananciaBruta - meta.meta_gastos_fijos;
    const breakEvenEntregas = meta.utilidad_por_pedido > 0 ? Math.ceil(meta.meta_gastos_fijos / meta.utilidad_por_pedido) : 0;
    const breakEvenIniciales = (meta.pct_confirmacion * meta.pct_entrega) > 0
      ? Math.ceil(breakEvenEntregas / (meta.pct_confirmacion * meta.pct_entrega))
      : 0;
    return { confirmadas: Math.round(conf), entregadas: Math.round(entr), gananciaBruta, utilidadNeta, breakEvenEntregas, breakEvenIniciales };
  }, [meta]);

  // ====== ACCIONES ======
  async function guardarMeta() {
    setSavingMeta(true);
    const payload: any = { espacio_id: espacioId, ...meta };
    delete payload.id;
    const { error } = await supabase.from("emp_metas").upsert(payload, { onConflict: "espacio_id" });
    setSavingMeta(false);
    if (error) { alert(error.message); return; }
    router.refresh();
  }

  async function registrarDia() {
    if (formVentas === "" && formProductos === "") return;
    setSavingTrack(true);
    const payload = {
      espacio_id: espacioId,
      fecha: formFecha,
      ventas_dia: Number(formVentas) || 0,
      productos_montados: Number(formProductos) || 0,
    };
    const { data, error } = await supabase.from("emp_metas_tracking")
      .upsert(payload, { onConflict: "espacio_id,fecha" }).select().single();
    setSavingTrack(false);
    if (error) { alert(error.message); return; }
    setTracking(prev => {
      const otros = prev.filter(t => t.fecha !== payload.fecha);
      return [data as Tracking, ...otros].sort((a, b) => b.fecha.localeCompare(a.fecha));
    });
    setFormVentas("");
    setFormProductos("");
    router.refresh();
  }

  async function borrarTracking(id: string, fecha: string) {
    if (!confirm(`¿Borrar el registro del ${fecha}?`)) return;
    const { error } = await supabase.from("emp_metas_tracking").delete().eq("id", id);
    if (error) { alert(error.message); return; }
    setTracking(tracking.filter(t => t.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* ====== HEADER ====== */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center relative">
          <div className="absolute inset-0 rounded-xl bg-primary/20 blur-md"></div>
          <Target className="h-5 w-5 text-primary relative" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Proyección & Metas</h1>
          <p className="text-xs text-muted-foreground">
            Cambia un número y el resto se calcula solo. Pídele al coach que registre por ti.
          </p>
        </div>
      </div>

      {/* ====== SEMÁFOROS — ESTOY CUMPLIENDO? ====== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Semaforo titulo="Hoy"          real={stats.ventasHoy}    meta={meta.meta_ventas_diarias}    esperado={esperado.dia}    estado={semaforos.dia} />
        <Semaforo titulo="Semana"       real={stats.ventasSem}    meta={meta.meta_ventas_semanales}  esperado={esperado.semana} estado={semaforos.semana} />
        <Semaforo titulo="Mes"          real={stats.ventasMes}    meta={meta.meta_ventas_mensuales}  esperado={esperado.mes}    estado={semaforos.mes} />
        <Semaforo titulo="Prod. testeo" real={stats.productosMes} meta={meta.meta_productos_testeo_mes} esperado={meta.meta_productos_testeo_mes} estado={semaforos.productos} />
      </div>

      {/* ====== REGISTRAR DÍA ====== */}
      <Bloque icon={<Plus className="h-4 w-4" />} titulo="Registrar día" subtitulo="Si la fecha ya existe, se actualiza.">
        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Fecha</Label>
            <Input type="date" value={formFecha} onChange={(e) => setFormFecha(e.target.value)} className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ventas del día</Label>
            <Input
              type="number" min={0}
              value={formVentas}
              onChange={(e) => setFormVentas(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="0"
              className="h-10 tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Productos nuevos</Label>
            <Input
              type="number" min={0}
              value={formProductos}
              onChange={(e) => setFormProductos(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="0"
              className="h-10 tabular-nums"
            />
          </div>
          <Button onClick={registrarDia} disabled={savingTrack} className="h-10">
            {savingTrack ? "Guardando…" : "Guardar día"}
          </Button>
        </div>
      </Bloque>

      {/* ====== CALCULADORA AUTOMÁTICA ====== */}
      <Bloque icon={<Calculator className="h-4 w-4" />} titulo="Calculadora automática" subtitulo="Edita cualquier campo y los demás se ajustan solos.">
        <div className="space-y-4">
          {/* Fila A — utilidad por pedido + porcentajes */}
          <div className="grid sm:grid-cols-3 gap-3">
            <Campo label={`Utilidad por pedido (${moneda})`} hint="Lo que te queda por cada entrega real">
              <Input
                type="number" step="100"
                value={meta.utilidad_por_pedido}
                onChange={(e) => actualizarUtilidad(Number(e.target.value) || 0)}
                className="h-10 tabular-nums"
              />
            </Campo>
            <Campo label="% Confirmación (0–1)" hint="Cuántas se confirman">
              <Input
                type="number" step="0.05" min="0" max="1"
                value={meta.pct_confirmacion}
                onChange={(e) => actualizarConfirmacion(Number(e.target.value) || 0)}
                className="h-10 tabular-nums"
              />
            </Campo>
            <Campo label="% Entrega (0–1)" hint="De las confirmadas, cuántas entregadas">
              <Input
                type="number" step="0.05" min="0" max="1"
                value={meta.pct_entrega}
                onChange={(e) => actualizarEntrega(Number(e.target.value) || 0)}
                className="h-10 tabular-nums"
              />
            </Campo>
          </div>

          {/* Fila B — meta ventas día / semana / mes (sincronizados) */}
          <div className="grid sm:grid-cols-3 gap-3">
            <Campo label="Meta ventas / día" hint="Auto: meta_mes ÷ 30">
              <Input
                type="number" min="0"
                value={meta.meta_ventas_diarias}
                onChange={(e) => actualizarDia(Number(e.target.value) || 0)}
                className="h-10 tabular-nums"
              />
            </Campo>
            <Campo label="Meta ventas / semana" hint="Auto: meta_día × 7">
              <Input
                type="number" min="0"
                value={meta.meta_ventas_semanales}
                onChange={(e) => actualizarSemana(Number(e.target.value) || 0)}
                className="h-10 tabular-nums"
              />
            </Campo>
            <Campo label="Meta ventas / mes" hint="Edita aquí o desde ganancia">
              <Input
                type="number" min="0"
                value={meta.meta_ventas_mensuales}
                onChange={(e) => actualizarMes(Number(e.target.value) || 0)}
                className="h-10 tabular-nums"
              />
            </Campo>
          </div>

          {/* Fila C — ganancia bruta (reversa) */}
          <div className="grid sm:grid-cols-2 gap-3">
            <Campo label={`Ganancia bruta esperada (${moneda})`} hint="Cuánto quieres ganar al mes (calcula ventas)">
              <Input
                type="number" step="100000"
                value={meta.meta_ganancia}
                onChange={(e) => actualizarGanancia(Number(e.target.value) || 0)}
                className="h-10 tabular-nums font-semibold"
              />
            </Campo>
            <Campo label={`Gastos fijos del mes (${moneda})`} hint="Renta, sueldos, herramientas, etc.">
              <Input
                type="number" step="100000"
                value={meta.meta_gastos_fijos}
                onChange={(e) => setMeta({ ...meta, meta_gastos_fijos: Number(e.target.value) || 0 })}
                className="h-10 tabular-nums"
              />
            </Campo>
          </div>

          {/* Productos en testeo */}
          <Campo label="Meta productos en testeo / mes">
            <Input
              type="number" min="0"
              value={meta.meta_productos_testeo_mes}
              onChange={(e) => setMeta({ ...meta, meta_productos_testeo_mes: Number(e.target.value) || 0 })}
              className="h-10 tabular-nums"
            />
          </Campo>

          {/* Observación */}
          <Campo label="Notas">
            <textarea
              value={meta.observacion ?? ""}
              onChange={(e) => setMeta({ ...meta, observacion: e.target.value })}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Contexto, supuestos, ajustes…"
            />
          </Campo>

          <Button onClick={guardarMeta} disabled={savingMeta} className="shadow-md shadow-primary/20">
            <Save className="h-4 w-4 mr-1" /> {savingMeta ? "Guardando…" : "Guardar metas"}
          </Button>
        </div>
      </Bloque>

      {/* ====== VISTA PREVIA EN VIVO ====== */}
      <Bloque icon={<TrendingUp className="h-4 w-4" />} titulo="Flujo proyectado del mes" subtitulo="Así se ven tus números si cumples las metas.">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <NumeroBig label="Ventas iniciales" valor={meta.meta_ventas_mensuales.toLocaleString("es-CO")} sub="pedidos brutos" />
          <NumeroBig label={`Confirmadas (${Math.round(meta.pct_confirmacion * 100)}%)`} valor={calc.confirmadas.toLocaleString("es-CO")} sub="entran al flujo" colorClass="text-blue-500" />
          <NumeroBig label={`Entregadas (${Math.round(meta.pct_entrega * 100)}%)`} valor={calc.entregadas.toLocaleString("es-CO")} sub="generan ingreso" colorClass="text-emerald-500" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <BloqueDinero
            titulo="Ganancia bruta esperada"
            valor={formatMoney(calc.gananciaBruta, moneda)}
            sub={`${calc.entregadas.toLocaleString("es-CO")} entregadas × ${formatMoney(meta.utilidad_por_pedido, moneda)}/pedido`}
            tipo="positivo"
          />
          <BloqueDinero
            titulo={calc.utilidadNeta >= 0 ? "Utilidad neta (- gastos)" : "PÉRDIDA del mes"}
            valor={formatMoney(calc.utilidadNeta, moneda)}
            sub={`Ganancia - ${formatMoney(meta.meta_gastos_fijos, moneda)} gastos`}
            tipo={calc.utilidadNeta >= 0 ? "positivo" : "negativo"}
          />
        </div>

        {meta.meta_gastos_fijos > 0 && meta.utilidad_por_pedido > 0 && (
          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              <DollarSign className="h-3.5 w-3.5" /> Punto de equilibrio
            </div>
            <p>
              Necesitas <b className="text-foreground">{calc.breakEvenEntregas.toLocaleString("es-CO")}</b> entregas
              {" "}(<b>{calc.breakEvenIniciales.toLocaleString("es-CO")}</b> pedidos iniciales) en el mes para cubrir tus gastos fijos
              de <b>{formatMoney(meta.meta_gastos_fijos, moneda)}</b>.
            </p>
          </div>
        )}
      </Bloque>

      {/* ====== HISTORIAL ====== */}
      <Bloque icon={<Calendar className="h-4 w-4" />} titulo="Historial de días registrados" subtitulo={`${tracking.length} días`}>
        {tracking.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Aún no has registrado días.</p>
        ) : (
          <div className="divide-y divide-border">
            {tracking.slice(0, 30).map(t => (
              <div key={t.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <div className="text-xs font-mono tabular-nums text-muted-foreground w-24">{t.fecha}</div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="inline-flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-primary" />
                      <b className="tabular-nums">{t.ventas_dia}</b>
                      <span className="text-muted-foreground text-xs">ventas</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Plus className="h-3 w-3 text-amber-500" />
                      <b className="tabular-nums">{t.productos_montados}</b>
                      <span className="text-muted-foreground text-xs">productos</span>
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => borrarTracking(t.id, t.fecha)}
                  title="Borrar"
                  className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Bloque>
    </div>
  );
}

// ============================================================
// SUB-COMPONENTES
// ============================================================

function Semaforo({ titulo, real, meta, esperado, estado }: {
  titulo: string; real: number; meta: number; esperado: number;
  estado: { label: string; color: string; bg: string; icon: any; pct?: number };
}) {
  const Icon = estado.icon;
  const pctMeta = meta > 0 ? Math.min((real / meta) * 100, 100) : 0;
  return (
    <div className={cn("rounded-xl border border-border p-3", estado.bg)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{titulo}</span>
        <span className={cn("text-[10px] inline-flex items-center gap-1 font-semibold", estado.color)}>
          <Icon className="h-3 w-3" /> {estado.label}
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tabular-nums">{real.toLocaleString("es-CO")}</span>
        <span className="text-[10px] text-muted-foreground">/ {meta.toLocaleString("es-CO")}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", estado.color.replace("text-", "bg-"))}
          style={{ width: `${pctMeta}%` }}
        ></div>
      </div>
      {esperado > 0 && (
        <p className="text-[10px] text-muted-foreground mt-1">
          Esperado al día de hoy: <b className="text-foreground">{Math.round(esperado).toLocaleString("es-CO")}</b>
        </p>
      )}
    </div>
  );
}

function Bloque({ icon, titulo, subtitulo, children }: {
  icon: React.ReactNode; titulo: string; subtitulo?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-primary">{icon}</span>
          <h2 className="text-sm font-semibold">{titulo}</h2>
        </div>
        {subtitulo && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitulo}</p>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Campo({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function NumeroBig({ label, valor, sub, colorClass }: { label: string; valor: string; sub?: string; colorClass?: string }) {
  return (
    <div className="text-center rounded-lg border border-border bg-muted/30 py-3 px-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={cn("text-2xl font-bold tabular-nums mt-1", colorClass)}>{valor}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function BloqueDinero({ titulo, valor, sub, tipo }: {
  titulo: string; valor: string; sub?: string; tipo: "positivo" | "negativo";
}) {
  return (
    <div className={cn(
      "rounded-lg border p-3",
      tipo === "positivo" ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/30 bg-rose-500/5"
    )}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{titulo}</div>
      <div className={cn(
        "text-xl font-bold tabular-nums mt-1",
        tipo === "positivo" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      )}>{valor}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}
