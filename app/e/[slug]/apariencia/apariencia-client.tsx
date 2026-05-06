"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TEMAS, FUENTES, MODOS, DENSIDADES, type Preferencias, type Tema, type Fuente, type Modo, type Densidad } from "@/lib/apariencia";
import { Check, Palette, Type, Sun, Maximize2, Save, RotateCcw } from "lucide-react";

export function AparienciaClient({ initial, espacioId, espacioNombre }: { initial: Preferencias; espacioId: string; espacioNombre: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [prefs, setPrefs] = useState<Preferencias>(initial);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Aplicar cambios en VIVO al <html> mientras eligen (preview instantáneo)
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-theme", prefs.tema);
    html.setAttribute("data-mode", prefs.modo);
    html.setAttribute("data-font", prefs.fuente);
    html.setAttribute("data-density", prefs.densidad);
  }, [prefs]);

  async function guardar() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert("Sesión expirada"); setSaving(false); return; }
    // Guardar para este espacio en particular
    const { error } = await supabase.from("preferencias_espacio").upsert({
      perfil_id: user.id,
      espacio_id: espacioId,
      tema: prefs.tema,
      fuente: prefs.fuente,
      modo: prefs.modo,
      densidad: prefs.densidad,
      updated_at: new Date().toISOString(),
    }, { onConflict: "perfil_id,espacio_id" });
    setSaving(false);
    if (error) { alert(error.message); return; }
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
    router.refresh();
  }

  function resetear() {
    setPrefs({ tema: "azul", fuente: "Inter", modo: "auto", densidad: "normal" });
  }

  const dirty = JSON.stringify(prefs) !== JSON.stringify(initial);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Palette className="h-7 w-7 text-primary" /> Apariencia</h1>
          <p className="text-muted-foreground">Personaliza tema, fuente, modo y densidad <b>solo para este espacio</b> ({espacioNombre}). Cada espacio tiene su propio estilo.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetear} disabled={!dirty && prefs.tema === "azul" && prefs.fuente === "Inter"}>
            <RotateCcw className="h-4 w-4 mr-1" /> Restablecer
          </Button>
          <Button onClick={guardar} disabled={!dirty || saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : savedFlash ? "✓ Guardado" : "Guardar"}
          </Button>
        </div>
      </div>

      {dirty && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-2 text-sm">
          Estás viendo un preview en vivo. Dale <span className="font-semibold">Guardar</span> para que persista.
        </div>
      )}

      {/* Paleta de colores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" /> Paleta de colores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TEMAS.map((t) => {
              const active = prefs.tema === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setPrefs({ ...prefs, tema: t.value as Tema })}
                  className={cn(
                    "relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm transition-all hover:scale-105",
                    active ? "border-primary brand-glow" : "border-border hover:border-primary/40"
                  )}
                >
                  <div className="h-10 w-10 rounded-full" style={{ background: t.preview }} />
                  <span className="font-medium">{t.emoji} {t.label}</span>
                  {active && <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Modo claro/oscuro */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sun className="h-4 w-4" /> Modo claro / oscuro</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {MODOS.map((m) => {
              const active = prefs.modo === m.value;
              return (
                <button
                  key={m.value}
                  onClick={() => setPrefs({ ...prefs, modo: m.value as Modo })}
                  className={cn(
                    "rounded-lg border-2 p-4 text-sm transition-all hover:scale-105",
                    active ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  )}
                >
                  <div className="text-3xl mb-2">{m.emoji}</div>
                  <div className="font-medium">{m.label}</div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Fuentes */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Type className="h-4 w-4" /> Tipografía</CardTitle></CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {FUENTES.map((f) => {
              const active = prefs.fuente === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setPrefs({ ...prefs, fuente: f.value as Fuente })}
                  className={cn(
                    "text-left rounded-lg border-2 p-4 transition-all hover:scale-[1.02]",
                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  )}
                  style={{ fontFamily: `"${f.value}", sans-serif` }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-lg">{f.label}</div>
                      <div className="text-sm text-muted-foreground mt-1">{f.sample}</div>
                    </div>
                    {active && <Check className="h-5 w-5 text-primary shrink-0 ml-2" />}
                  </div>
                  <div className="mt-2 text-2xl font-semibold tabular-nums">$1,234,567</div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Densidad */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Maximize2 className="h-4 w-4" /> Densidad de la interfaz</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {DENSIDADES.map((d) => {
              const active = prefs.densidad === d.value;
              return (
                <button
                  key={d.value}
                  onClick={() => setPrefs({ ...prefs, densidad: d.value as Densidad })}
                  className={cn(
                    "rounded-lg border-2 p-4 text-sm transition-all hover:scale-105",
                    active ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  )}
                >
                  <div className="font-medium">{d.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{d.desc}</div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Preview en vivo */}
      <Card>
        <CardHeader><CardTitle className="text-base">Preview de tu configuración</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">Capital</p>
              <p className="text-2xl font-bold tabular-nums">$5,420,000</p>
              <div className="mt-2 h-1.5 bg-muted rounded overflow-hidden"><div className="h-full bg-primary w-3/4" /></div>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">Gastos</p>
              <p className="text-2xl font-bold tabular-nums text-destructive">$2,180,500</p>
              <div className="mt-2 h-1.5 bg-muted rounded overflow-hidden"><div className="h-full bg-destructive w-1/2" /></div>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="text-xs text-muted-foreground">Ahorro</p>
              <p className="text-2xl font-bold tabular-nums text-success">$890,000</p>
              <div className="mt-2 h-1.5 bg-muted rounded overflow-hidden"><div className="h-full bg-success w-1/3" /></div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button>Botón primario</Button>
            <Button variant="outline">Secundario</Button>
            <Button variant="ghost">Ghost</Button>
          </div>
          <p className="text-sm text-muted-foreground">Texto normal con la fuente <span className="font-semibold">{prefs.fuente}</span> y paleta <span className="font-semibold">{TEMAS.find(t => t.value === prefs.tema)?.label}</span>.</p>
        </CardContent>
      </Card>
    </div>
  );
}
