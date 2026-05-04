"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Send, X, Loader2, Sparkles, MessageCircle } from "lucide-react";

interface Mensaje {
  id: string;
  rol: "usuario" | "coach";
  texto: string;
  ts: number;
}

const STORAGE_KEY = "coach-chat-history";

const EJEMPLOS = [
  "gasté 50k en pauta",
  "ya hice gym",
  "reunión mañana 3pm con miguel",
  "cumplí 3 hábitos hoy",
];

const SALUDO_INICIAL: Mensaje = {
  id: "init",
  rol: "coach",
  texto: "¡Hola! Cuéntame qué hiciste, qué gastaste o qué quieres planear. Yo lo registro por ti.",
  ts: Date.now(),
};

export function CoachChat() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([SALUDO_INICIAL]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hidratar historial
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as Mensaje[];
        if (Array.isArray(arr) && arr.length > 0) setMensajes(arr);
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  // Persistir
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(mensajes.slice(-50))); } catch { /* ignore */ }
  }, [mensajes, hydrated]);

  // Auto-scroll al último
  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [mensajes, open, enviando]);

  // Focus input al abrir
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  async function enviar(textoForzado?: string) {
    const t = (textoForzado ?? texto).trim();
    if (!t || enviando) return;
    const idMsg = String(Date.now());
    setMensajes(m => [...m, { id: idMsg + "-u", rol: "usuario", texto: t, ts: Date.now() }]);
    setTexto("");
    setEnviando(true);
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
      setMensajes(m => [...m, { id: idMsg + "-c", rol: "coach", texto: data.respuesta || "Listo.", ts: Date.now() }]);
      router.refresh();
    } catch (e: any) {
      setMensajes(m => [...m, { id: idMsg + "-e", rol: "coach", texto: `⚠️ ${e.message ?? "error"}`, ts: Date.now() }]);
    } finally {
      setEnviando(false);
    }
  }

  function limpiar() {
    if (!confirm("¿Borrar la conversación?")) return;
    setMensajes([SALUDO_INICIAL]);
  }

  if (!hydrated) return null;

  // ===== BOTÓN FLOTANTE (cerrado) =====
  // Posición: bottom-right, arriba del Pomodoro (que está en bottom-4 right-4 con altura ~56px)
  // Animación: floating sutil + glow.
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-52 right-12 z-50 group flex flex-col items-end"
        aria-label="Abrir chat con tu coach"
      >
        {/* Burbuja "tipo nube" — siempre visible */}
        <div className="relative mb-2 mr-4 px-3 py-1.5 rounded-2xl bg-card border-2 border-primary/40 shadow-lg text-xs font-medium max-w-[160px] text-center brand-glow">
          <span>¡Hola! Háblame ✨</span>
          {/* Triangulito hacia abajo (lado derecho, apuntando al avatar) */}
          <div className="absolute -bottom-1.5 right-6 w-3 h-3 rotate-45 bg-card border-r-2 border-b-2 border-primary/40" />
        </div>

        {/* Avatar 3D flotante (sin recorte, fondo transparente, varias sombras para profundidad) */}
        <div className="relative animate-coach-float">
          {/* Aurora detrás (resplandor radial del color del tema) */}
          <div className="absolute inset-0 rounded-full bg-primary/40 blur-3xl scale-75 animate-pulse pointer-events-none" />

          {/* Personaje */}
          <div className="relative h-52 w-40 hover:scale-105 transition-transform duration-300 ease-out">
            <Image
              src="/coach-avatar.png"
              alt="Tu coach"
              fill
              className="object-contain object-bottom"
              style={{
                filter: "drop-shadow(0 4px 6px rgba(0,0,0,.18)) drop-shadow(0 12px 24px rgba(0,0,0,.25)) drop-shadow(0 0 22px hsl(var(--primary) / 0.45))",
              }}
              priority
            />
          </div>

          {/* Sombra ovalada en el "piso" — fija (no se mueve con el flotar) */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-24 h-3 rounded-full bg-black/40 blur-md animate-coach-shadow" />
        </div>
      </button>
    );
  }

  // ===== PANEL ABIERTO =====
  return (
    <div className="fixed bottom-52 right-12 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-8rem)] flex flex-col rounded-2xl border-2 border-primary/40 bg-card shadow-2xl overflow-hidden brand-glow">
      {/* HEADER */}
      <div className="flex items-center gap-3 p-3 border-b bg-gradient-to-r from-primary/10 to-transparent">
        <div className="relative h-10 w-10 rounded-full overflow-hidden border-2 border-primary shrink-0">
          <Image src="/coach-avatar.png" alt="Coach" fill className="object-cover object-top scale-[1.8]" />
          <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-success border-2 border-card" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight">Tu Coach</div>
          <div className="text-[10px] text-success">● En línea</div>
        </div>
        <button onClick={limpiar} className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted" title="Limpiar conversación">
          <Sparkles className="h-4 w-4" />
        </button>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted" title="Cerrar">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* MENSAJES */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 bg-background/50">
        {mensajes.map(m => (
          <Burbuja key={m.id} m={m} />
        ))}
        {enviando && (
          <div className="flex items-end gap-2">
            <div className="relative h-8 w-8 rounded-full overflow-hidden border border-primary/40 shrink-0">
              <Image src="/coach-avatar.png" alt="" fill className="object-cover object-top scale-[1.8]" />
            </div>
            <div className="rounded-2xl rounded-bl-sm bg-card border px-3 py-2 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>

      {/* EJEMPLOS (solo si chat vacío) */}
      {mensajes.length <= 1 && !enviando && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {EJEMPLOS.map(ej => (
            <button
              key={ej}
              onClick={() => enviar(ej)}
              className="text-[11px] px-2 py-1 rounded-full border bg-card hover:border-primary hover:bg-primary/5 transition-colors"
            >
              {ej}
            </button>
          ))}
        </div>
      )}

      {/* INPUT */}
      <form
        onSubmit={(e) => { e.preventDefault(); enviar(); }}
        className="flex gap-2 p-3 border-t bg-card"
      >
        <Input
          ref={inputRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe lo que quieras..."
          disabled={enviando}
          className="text-sm h-10"
        />
        <Button type="submit" size="icon" disabled={enviando || !texto.trim()} className="h-10 w-10 shrink-0">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}

function Burbuja({ m }: { m: Mensaje }) {
  const esUsuario = m.rol === "usuario";
  return (
    <div className={cn("flex items-end gap-2", esUsuario ? "flex-row-reverse" : "flex-row")}>
      {!esUsuario && (
        <div className="relative h-8 w-8 rounded-full overflow-hidden border border-primary/40 shrink-0">
          <Image src="/coach-avatar.png" alt="" fill className="object-cover object-top scale-[1.8]" />
        </div>
      )}
      <div className={cn(
        "rounded-2xl px-3 py-2 max-w-[78%] text-sm whitespace-pre-wrap break-words",
        esUsuario
          ? "bg-primary text-primary-foreground rounded-br-sm"
          : "bg-card border rounded-bl-sm"
      )}>
        {m.texto}
      </div>
    </div>
  );
}
