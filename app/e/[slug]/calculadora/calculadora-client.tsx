"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/money-input";
import { createClient } from "@/lib/supabase/client";
import { calcularPrecio } from "@/lib/calc";
import { formatMoney, formatPct } from "@/lib/utils";
import type { CountryConfig } from "@/lib/types";

const CURRENCY_SYMBOLS: Record<string, string> = { COP: "$", MXN: "$", USD: "$", EUR: "€", CLP: "$" };

export function CalculadoraClient({ paises: paisesInit }: { paises: CountryConfig[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [paises, setPaises] = useState(paisesInit);
  const [code, setCode] = useState(paisesInit[0].code);
  const [precio, setPrecio] = useState<number | "">("");
  const [showConfig, setShowConfig] = useState(false);
  const [savingCfg, setSavingCfg] = useState(false);
  const [cfgMsg, setCfgMsg] = useState<string | null>(null);

  const cfg = useMemo(() => paises.find((p) => p.code === code)!, [paises, code]);
  const result = useMemo(() => {
    if (precio === "" || precio <= 0) return null;
    return calcularPrecio(precio, cfg);
  }, [precio, cfg]);

  // Editar parámetros del país en vivo (recalcula automáticamente)
  function updateCfg(patch: Partial<CountryConfig>) {
    setPaises(paises.map((p) => (p.code === code ? { ...p, ...patch } : p)));
  }

  async function guardarCfg() {
    setSavingCfg(true);
    setCfgMsg(null);
    const { error } = await supabase.from("paises_config").upsert({
      code: cfg.code, nombre: cfg.nombre, bandera: cfg.bandera, moneda: cfg.moneda,
      flete_base: cfg.flete_base, pct_entrega: cfg.pct_entrega,
      pct_cpa_objetivo: cfg.pct_cpa_objetivo, pct_utilidad_objetivo: cfg.pct_utilidad_objetivo,
      pct_comparacion: cfg.pct_comparacion,
    });
    setSavingCfg(false);
    if (error) { setCfgMsg(`Error: ${error.message}`); return; }
    setCfgMsg(`✓ Parámetros de ${cfg.nombre} guardados`);
    router.refresh();
    setTimeout(() => setCfgMsg(null), 2500);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Calculadora de precios</h1>
        <p className="text-muted-foreground">Selecciona país, escribe el precio del proveedor y obtén el PV automático.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Entrada</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>País</Label>
            <Select value={code} onChange={(e) => setCode(e.target.value as any)}>
              {paises.map((p) => (
                <option key={p.code} value={p.code}>{p.bandera} {p.nombre} ({p.moneda})</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Precio proveedor ({cfg.moneda})</Label>
            <MoneyInput value={precio} onValueChange={setPrecio}
              currency={CURRENCY_SYMBOLS[cfg.moneda] ?? "$"} autoFocus />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-muted-foreground">
              Flete {formatMoney(cfg.flete_base, cfg.moneda)} · entrega {formatPct(cfg.pct_entrega)} · CPA {formatPct(cfg.pct_cpa_objetivo)} · utilidad {formatPct(cfg.pct_utilidad_objetivo)}
            </p>
            <button
              type="button"
              onClick={() => setShowConfig(v => !v)}
              className="text-xs text-primary underline"
            >
              {showConfig ? "Ocultar parámetros" : "✎ Editar parámetros aquí"}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* PARÁMETROS EDITABLES — del país seleccionado, sin salir de aquí */}
      {showConfig && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-xl">{cfg.bandera}</span> Parámetros de {cfg.nombre}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Edita y mira el resultado cambiar al instante. Dale Guardar para dejarlo fijo.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <CfgField label={`Flete base (${cfg.moneda})`} value={cfg.flete_base} step={100} onChange={(v) => updateCfg({ flete_base: v })} />
              <CfgField label="% Entrega (0–1)" value={cfg.pct_entrega} step={0.05} max={1} onChange={(v) => updateCfg({ pct_entrega: v })} />
              <CfgField label="% CPA objetivo (0–1)" value={cfg.pct_cpa_objetivo} step={0.05} max={0.99} onChange={(v) => updateCfg({ pct_cpa_objetivo: v })} />
              <CfgField label="% Utilidad objetivo (0–1)" value={cfg.pct_utilidad_objetivo} step={0.05} max={0.99} onChange={(v) => updateCfg({ pct_utilidad_objetivo: v })} />
              <CfgField label="% Comparación / ancla" value={cfg.pct_comparacion} step={0.05} max={2} onChange={(v) => updateCfg({ pct_comparacion: v })} />
            </div>
            {cfgMsg && <div className="text-xs rounded-md border bg-muted/50 px-3 py-2">{cfgMsg}</div>}
            <Button onClick={guardarCfg} disabled={savingCfg} className="shadow-md shadow-primary/20">
              {savingCfg ? "Guardando…" : "Guardar parámetros"}
            </Button>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <BigStat title="Precio venta sugerido" value={formatMoney(result.precio_venta, cfg.moneda)} highlight />
            <BigStat title="Utilidad por venta" value={formatMoney(result.utilidad, cfg.moneda)} subtitle={`Margen ${formatPct(result.margen_pct)}`} />
            <BigStat title="Precio comparación" value={formatMoney(result.precio_comparacion, cfg.moneda)} subtitle="Para landing/copy" />
          </div>

          {/* OFERTAS DE CANTIDAD — combos x2 / x3 */}
          <Card className="border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">📦 Ofertas de cantidad (combos)</CardTitle>
              <p className="text-xs text-muted-foreground">
                Cada unidad extra suma solo el costo del producto + tu utilidad. Mismo envío, misma pauta → más margen.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <ComboBox
                titulo="1 unidad"
                precio={formatMoney(result.precio_venta, cfg.moneda)}
                utilidad={formatMoney(result.utilidad, cfg.moneda)}
                margen={formatPct(result.margen_pct)}
              />
              <ComboBox
                titulo="2 unidades"
                precio={formatMoney(result.precio_2und, cfg.moneda)}
                utilidad={formatMoney(result.utilidad_2und, cfg.moneda)}
                margen={formatPct(result.margen_2und)}
                destacado
              />
              <ComboBox
                titulo="3 unidades"
                precio={formatMoney(result.precio_3und, cfg.moneda)}
                utilidad={formatMoney(result.utilidad_3und, cfg.moneda)}
                margen={formatPct(result.margen_3und)}
                destacado
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Desglose completo</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label="Precio proveedor" value={formatMoney(result.precio_proveedor, cfg.moneda)} />
              <Row label="Flete base" value={formatMoney(result.flete_base, cfg.moneda)} />
              <Row label={`Flete c/devoluciones (entrega ${formatPct(cfg.pct_entrega)})`} value={formatMoney(result.flete_con_devoluciones, cfg.moneda)} />
              <Row label={`CPA costeado (${formatPct(cfg.pct_cpa_objetivo)})`} value={formatMoney(result.cpa_costeado, cfg.moneda)} />
              <Row label="Costos totales" value={formatMoney(result.costos_totales, cfg.moneda)} bold />
              <Row label={`Utilidad (${formatPct(cfg.pct_utilidad_objetivo)})`} value={formatMoney(result.utilidad, cfg.moneda)} positive />
              <Row label="Precio de venta" value={formatMoney(result.precio_venta, cfg.moneda)} bold highlight />
              <Row label={`Comparación (+${formatPct(cfg.pct_comparacion)})`} value={formatMoney(result.precio_comparacion, cfg.moneda)} />
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="pt-6 text-sm space-y-1">
              <p>💡 <strong>Vendiendo 1 unidad</strong> ganas <strong>{formatMoney(result.utilidad, cfg.moneda)}</strong> ({formatPct(result.margen_pct)} de margen).</p>
              <p>📦 Para cubrir <strong>{formatMoney(1_000_000, cfg.moneda)}</strong> de gastos fijos necesitas <strong>{Math.ceil(1_000_000 / result.utilidad).toLocaleString("es-CO")}</strong> unidades.</p>
              <p>🚀 Si CPA real {"<"} <strong>{formatMoney(result.cpa_costeado, cfg.moneda)}</strong>, ganas más.</p>
            </CardContent>
          </Card>
        </>
      )}

      {!result && precio === "" && (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Escribe un precio del proveedor para ver el resultado.</CardContent></Card>
      )}
    </div>
  );
}

function BigStat({ title, value, subtitle, highlight }: { title: string; value: string; subtitle?: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary border-2 brand-glow" : ""}>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold tabular-nums ${highlight ? "text-primary" : ""}`}>{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function CfgField({ label, value, onChange, step, max }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; max?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        step={step ?? 0.01}
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-10 tabular-nums"
      />
    </div>
  );
}

function ComboBox({ titulo, precio, utilidad, margen, destacado }: {
  titulo: string; precio: string; utilidad: string; margen: string; destacado?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 text-center ${destacado ? "border-primary/50 bg-primary/5" : "border-border bg-muted/20"}`}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{titulo}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${destacado ? "text-primary" : ""}`}>{precio}</div>
      <div className="mt-2 pt-2 border-t border-border/50 text-xs space-y-0.5">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Utilidad</span>
          <span className="font-medium tabular-nums text-success">{utilidad}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Margen</span>
          <span className="font-medium tabular-nums">{margen}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, positive, highlight }: { label: string; value: string; bold?: boolean; positive?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex justify-between py-2 ${bold ? "border-t font-semibold" : ""} ${highlight ? "text-primary" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className={`tabular-nums ${positive ? "text-success font-medium" : ""}`}>{value}</span>
    </div>
  );
}
