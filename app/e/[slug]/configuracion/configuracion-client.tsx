"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { CountryConfig } from "@/lib/types";

export function ConfiguracionClient({ paises: initial }: { paises: CountryConfig[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [paises, setPaises] = useState(initial);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const update = (code: string, patch: Partial<CountryConfig>) => {
    setPaises(paises.map((p) => (p.code === code ? { ...p, ...patch } : p)));
  };

  const save = async (p: CountryConfig) => {
    setSavingCode(p.code); setMsg(null);
    const { error } = await supabase.from("paises_config").upsert({
      code: p.code, nombre: p.nombre, bandera: p.bandera, moneda: p.moneda,
      flete_base: p.flete_base, pct_entrega: p.pct_entrega,
      pct_cpa_objetivo: p.pct_cpa_objetivo, pct_utilidad_objetivo: p.pct_utilidad_objetivo,
      pct_comparacion: p.pct_comparacion,
    });
    setSavingCode(null);
    if (error) { setMsg(`Error: ${error.message}`); return; }
    setMsg(`✓ ${p.nombre} guardado`);
    router.refresh();
    setTimeout(() => setMsg(null), 2500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuración</h1>
        <p className="text-muted-foreground">Edita los parámetros de la calculadora por país.</p>
      </div>

      {msg && <div className="rounded-md border bg-muted/50 p-3 text-sm">{msg}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {paises.map((p) => (
          <Card key={p.code}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">{p.bandera}</span> {p.nombre}
                <span className="text-xs font-normal text-muted-foreground">({p.moneda})</span>
              </CardTitle>
              <CardDescription>Valores de la calculadora</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label={`Flete base (${p.moneda})`} value={p.flete_base} onChange={(v) => update(p.code, { flete_base: v })} />
              <Field label="% Entrega sobre despachado" value={p.pct_entrega} onChange={(v) => update(p.code, { pct_entrega: v })} max={1} />
              <Field label="% CPA objetivo" value={p.pct_cpa_objetivo} onChange={(v) => update(p.code, { pct_cpa_objetivo: v })} max={0.99} />
              <Field label="% Utilidad objetivo" value={p.pct_utilidad_objetivo} onChange={(v) => update(p.code, { pct_utilidad_objetivo: v })} max={0.99} />
              <Field label="% Comparación / ancla" value={p.pct_comparacion} onChange={(v) => update(p.code, { pct_comparacion: v })} max={2} />
              <Button onClick={() => save(p)} disabled={savingCode === p.code} className="w-full">
                {savingCode === p.code ? "Guardando..." : "Guardar"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, max }: { label: string; value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div className="grid grid-cols-3 gap-2 items-center">
      <Label className="col-span-2 text-xs">{label}</Label>
      <Input type="number" step="0.01" min="0" max={max} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
    </div>
  );
}
