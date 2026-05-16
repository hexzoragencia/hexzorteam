"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { calcularPrecio } from "@/lib/calc";
import { formatMoney, formatPct } from "@/lib/utils";
import type { CountryConfig } from "@/lib/types";

const CURRENCY_SYMBOLS: Record<string, string> = { COP: "$", MXN: "$", USD: "$", EUR: "€", CLP: "$" };

export function CalculadoraClient({ paises }: { paises: CountryConfig[] }) {
  const [code, setCode] = useState(paises[0].code);
  const [precio, setPrecio] = useState<number | "">("");

  const cfg = useMemo(() => paises.find((p) => p.code === code)!, [paises, code]);
  const result = useMemo(() => {
    if (precio === "" || precio <= 0) return null;
    return calcularPrecio(precio, cfg);
  }, [precio, cfg]);

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
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Parámetros: flete base {formatMoney(cfg.flete_base, cfg.moneda)} · entrega {formatPct(cfg.pct_entrega)} · CPA {formatPct(cfg.pct_cpa_objetivo)} · utilidad {formatPct(cfg.pct_utilidad_objetivo)} · {" "}
            <Link href="../configuracion" className="underline">editar</Link>
          </p>
        </CardContent>
      </Card>

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
