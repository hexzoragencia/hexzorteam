"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, TrendingUp, TrendingDown, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface Consejo {
  saludo: string;
  frase: string;
  fortalezas: string;
  debilidades: string;
  sugerencia: string;
  cached?: boolean;
}

export function CoachCard() {
  const [consejo, setConsejo] = useState<Consejo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar(forzar = false) {
    if (forzar) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/consejo", {
        method: forzar ? "POST" : "GET",
        cache: "no-store",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setConsejo(data);
    } catch (e: any) {
      setError(e.message ?? "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { cargar(false); }, []);

  if (loading) {
    return (
      <Card className="border-primary/30">
        <CardContent className="pt-6 text-center text-sm text-muted-foreground py-12">
          <Sparkles className="h-8 w-8 mx-auto mb-2 text-primary animate-pulse" />
          Tu coach está pensando...
        </CardContent>
      </Card>
    );
  }
  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="pt-6 text-sm py-6">
          <p className="font-medium text-destructive">No pude cargar el consejo del día</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
          <p className="text-xs text-muted-foreground mt-2">Pega la migración del coach en Supabase si aún no lo has hecho, o verifica tu API key de OpenAI en .env.local.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => cargar(true)}>Reintentar</Button>
        </CardContent>
      </Card>
    );
  }
  if (!consejo) return null;

  return (
    <Card className="border-primary/40 brand-glow">
      <CardContent className="pt-5 pb-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary/15 p-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs uppercase tracking-wide text-primary font-semibold">Tu coach</span>
          </div>
          <button
            onClick={() => cargar(true)}
            disabled={refreshing}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Generar nuevo consejo"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>
        </div>

        {consejo.saludo && <h2 className="text-xl font-bold leading-tight">{consejo.saludo}</h2>}
        {consejo.frase && <p className="text-sm italic text-muted-foreground border-l-2 border-primary/40 pl-3">"{consejo.frase}"</p>}

        <div className="grid sm:grid-cols-3 gap-2 pt-1">
          {consejo.fortalezas && (
            <div className="rounded-md bg-success/10 border border-success/30 p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-success font-semibold mb-1">
                <TrendingUp className="h-3 w-3" /> Bien
              </div>
              <p className="text-xs leading-snug">{consejo.fortalezas}</p>
            </div>
          )}
          {consejo.debilidades && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-destructive font-semibold mb-1">
                <TrendingDown className="h-3 w-3" /> Falta
              </div>
              <p className="text-xs leading-snug">{consejo.debilidades}</p>
            </div>
          )}
          {consejo.sugerencia && (
            <div className="rounded-md bg-primary/10 border border-primary/30 p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-primary font-semibold mb-1">
                <Lightbulb className="h-3 w-3" /> Hoy haz
              </div>
              <p className="text-xs leading-snug">{consejo.sugerencia}</p>
            </div>
          )}
        </div>

        {consejo.cached && (
          <p className="text-[10px] text-muted-foreground text-right">Consejo del día — click ↻ para actualizar</p>
        )}
      </CardContent>
    </Card>
  );
}
