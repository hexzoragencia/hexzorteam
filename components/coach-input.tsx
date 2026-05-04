"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Send, Sparkles, Loader2, Check } from "lucide-react";

interface MensajeHistorial {
  usuario: string;
  respuesta: string;
  ts: number;
}

const EJEMPLOS = [
  "gasté 50k en pauta del producto chatea pro",
  "ya hice gym y leí",
  "reunión mañana 3pm con miguel 1 hora",
  "ya cerré la tienda colombia",
];

export function CoachInput() {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [historial, setHistorial] = useState<MensajeHistorial[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function enviar(textoForzado?: string) {
    const t = (textoForzado ?? texto).trim();
    if (!t || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/comando", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: t }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setHistorial(h => [...h, { usuario: t, respuesta: data.respuesta, ts: Date.now() }]);
      setTexto("");
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "error");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Háblale a tu coach</span>
          <span className="text-xs text-muted-foreground ml-auto">Registra cosas en lenguaje natural</span>
        </div>

        {/* Historial reciente (últimos 3) */}
        {historial.slice(-3).map((m, i) => (
          <div key={i} className="space-y-1.5 text-sm">
            <div className="flex items-start gap-2">
              <div className="rounded-full bg-muted h-6 w-6 flex items-center justify-center text-[10px] font-bold shrink-0">Tú</div>
              <p className="bg-muted/50 rounded-lg px-3 py-1.5 flex-1">{m.usuario}</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="rounded-full bg-primary/15 h-6 w-6 flex items-center justify-center shrink-0">
                <Sparkles className="h-3 w-3 text-primary" />
              </div>
              <p className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-1.5 flex-1 text-sm">{m.respuesta}</p>
            </div>
          </div>
        ))}

        {error && <p className="text-xs text-destructive">{error}</p>}

        {/* Input */}
        <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="flex gap-2">
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ej: gasté 50k en pauta, hice gym, agéndame reunión 3pm..."
            disabled={enviando}
            className="text-sm"
          />
          <Button type="submit" disabled={enviando || !texto.trim()} size="icon">
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>

        {/* Ejemplos clickeables (solo cuando no hay historial) */}
        {historial.length === 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide w-full">Prueba con:</span>
            {EJEMPLOS.map(ej => (
              <button
                key={ej}
                onClick={() => enviar(ej)}
                disabled={enviando}
                className="text-xs px-2 py-1 rounded-full border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                {ej}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
