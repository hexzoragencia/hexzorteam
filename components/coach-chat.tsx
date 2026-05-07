"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Send, X, Loader2, Sparkles, MessageCircle, Mic, Square } from "lucide-react";
import { useFloatingCorner, cornerClasses } from "./floating-pos";

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

const POS_KEY = "coach-avatar-pos";

export function CoachChat({ espacioId }: { espacioId?: string } = {}) {
  const router = useRouter();
  const { corner } = useFloatingCorner();
  const [open, setOpen] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([SALUDO_INICIAL]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [transcribiendo, setTranscribiendo] = useState(false);
  // Drag & drop libre para el muñeco cuando está cerrado
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; posX: number; posY: number; moved: boolean } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Hidratar posición guardada
  useEffect(() => {
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p?.x === "number" && typeof p?.y === "number") setPos(p);
      }
    } catch { /* ignore */ }
  }, []);

  // Drag handlers
  function onPointerDownAvatar(e: React.PointerEvent) {
    draggingRef.current = true;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      posX: rect.left,
      posY: rect.top,
      moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMoveAvatar(e: React.PointerEvent) {
    if (!draggingRef.current || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragStartRef.current.moved = true;
    const newX = dragStartRef.current.posX + dx;
    const newY = dragStartRef.current.posY + dy;
    // Limitar a bounds de la ventana
    const w = (e.currentTarget as HTMLElement).offsetWidth;
    const h = (e.currentTarget as HTMLElement).offsetHeight;
    const maxX = window.innerWidth - w;
    const maxY = window.innerHeight - h;
    setPos({
      x: Math.max(0, Math.min(maxX, newX)),
      y: Math.max(0, Math.min(maxY, newY)),
    });
  }
  function onPointerUpAvatar(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const wasMoved = dragStartRef.current?.moved === true;
    dragStartRef.current = null;
    // Persistir posición
    if (pos) {
      try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch { /* ignore */ }
    }
    // Si NO se movió (fue solo click), abrir chat
    if (!wasMoved) {
      setOpen(true);
    }
  }

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

  // ========== GRABACIÓN DE AUDIO ==========
  async function iniciarGrabacion() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Preferir webm/opus que es lo que graba bien Chrome y acepta Whisper
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        // Detener todas las tracks para liberar el micrófono
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size < 1000) {
          alert("Audio muy corto. Habla por al menos 1 segundo.");
          setTranscribiendo(false);
          return;
        }
        await transcribirYEnviar(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setGrabando(true);
    } catch (e: any) {
      alert("No pude acceder al micrófono: " + (e.message ?? "permiso denegado"));
    }
  }

  function detenerGrabacion() {
    if (!mediaRecorderRef.current) return;
    setGrabando(false);
    setTranscribiendo(true);
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
  }

  async function transcribirYEnviar(blob: Blob) {
    try {
      const ext = blob.type.includes("webm") ? "webm" : blob.type.includes("mp4") ? "m4a" : "wav";
      const file = new File([blob], `audio.${ext}`, { type: blob.type });
      const fd = new FormData();
      fd.append("audio", file);
      const res = await fetch("/api/coach/transcribir", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.texto) {
        throw new Error(data.error || "no pude transcribir");
      }
      const textoTranscrito = String(data.texto).trim();
      if (!textoTranscrito) {
        alert("No entendí el audio. Intenta de nuevo o escribe.");
        return;
      }
      // Enviar el mensaje transcrito como si fuera escrito
      await enviar(textoTranscrito);
    } catch (e: any) {
      alert("Error transcribiendo: " + (e.message ?? "intenta de nuevo"));
    } finally {
      setTranscribiendo(false);
    }
  }

  async function enviar(textoForzado?: string) {
    const t = (textoForzado ?? texto).trim();
    if (!t || enviando) return;
    const idMsg = String(Date.now());
    // Capturar el historial ANTES de añadir el nuevo mensaje (para no incluir 'texto' duplicado)
    const historial = mensajes.slice(-8).map(m => ({ rol: m.rol, texto: m.texto }));
    setMensajes(m => [...m, { id: idMsg + "-u", rol: "usuario", texto: t, ts: Date.now() }]);
    setTexto("");
    setEnviando(true);
    try {
      const res = await fetch("/api/coach/comando", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: t, espacio_id: espacioId, historial }),
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
  // Drag & drop libre: el usuario lo arrastra a donde quiera, posición se guarda
  // en localStorage. Si solo hace click (sin arrastrar), se abre el chat.
  if (!open) {
    // Estilo de posición: si hay pos guardada usar absolute; si no, usar las cornerClasses default
    const posStyle: React.CSSProperties = pos
      ? { position: "fixed", left: pos.x, top: pos.y, zIndex: 50 }
      : {};
    const fallbackPosClass = pos ? "" : cn("fixed z-50", cornerClasses(corner, true));

    return (
      <div
        onPointerDown={onPointerDownAvatar}
        onPointerMove={onPointerMoveAvatar}
        onPointerUp={onPointerUpAvatar}
        onPointerCancel={onPointerUpAvatar}
        style={{ ...posStyle, touchAction: "none", cursor: "grab" }}
        className={cn("group flex flex-col items-end select-none", fallbackPosClass)}
        aria-label="Coach IA — arrastra para mover, click para abrir"
      >
        {/* Burbuja "tipo nube" — siempre visible */}
        <div className="relative mb-2 mr-4 px-3 py-1.5 rounded-2xl bg-card border-2 border-primary/40 shadow-lg text-xs font-medium max-w-[160px] text-center brand-glow pointer-events-none">
          <span>¡Hola! Háblame ✨</span>
          <div className="absolute -bottom-1.5 right-6 w-3 h-3 rotate-45 bg-card border-r-2 border-b-2 border-primary/40" />
        </div>

        {/* Avatar 3D con nubes en la base */}
        <div className="relative animate-coach-float">
          {/* Aurora/glow detrás */}
          <div className="absolute inset-0 rounded-full bg-primary/40 blur-3xl scale-75 animate-pulse pointer-events-none" />

          {/* Personaje con mask gradient para que se difumine en los pies */}
          <div
            className="relative h-52 w-40 transition-transform duration-300 ease-out"
            style={{
              maskImage: "linear-gradient(to bottom, black 0%, black 65%, rgba(0,0,0,0.5) 85%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 65%, rgba(0,0,0,0.5) 85%, transparent 100%)",
            }}
          >
            <Image
              src="/coach-avatar.png"
              alt="Tu coach"
              fill
              className="object-contain object-bottom pointer-events-none"
              style={{
                filter: "drop-shadow(0 4px 6px rgba(0,0,0,.2)) drop-shadow(0 12px 24px rgba(0,0,0,.3)) drop-shadow(0 0 22px hsl(var(--primary) / 0.5))",
              }}
              priority
              draggable={false}
            />
          </div>

          {/* Nubes animadas en la base */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-44 h-12 pointer-events-none">
            <div className="absolute bottom-3 left-2 w-20 h-10 rounded-full bg-white/40 dark:bg-white/30 blur-xl animate-cloud-1" />
            <div className="absolute bottom-2 left-12 w-24 h-9 rounded-full bg-white/35 dark:bg-white/25 blur-xl animate-cloud-2" />
            <div className="absolute bottom-1 right-2 w-18 h-8 rounded-full bg-white/45 dark:bg-white/30 blur-lg animate-cloud-3" />
            <div className="absolute bottom-4 left-8 w-12 h-6 rounded-full bg-primary/30 blur-md animate-cloud-1" style={{ animationDelay: "1s" }} />
          </div>
        </div>
      </div>
    );
  }

  // ===== PANEL ABIERTO =====
  return (
    <div className={cn("fixed z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-8rem)] flex flex-col rounded-2xl border-2 border-primary/40 bg-card shadow-2xl overflow-hidden brand-glow", cornerClasses(corner, true))}>
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
          placeholder={grabando ? "🎙️ Grabando..." : transcribiendo ? "Transcribiendo audio..." : "Escribe o presiona el mic 🎤"}
          disabled={enviando || grabando || transcribiendo}
          className="text-sm h-10"
        />
        {/* Botón micrófono */}
        <Button
          type="button"
          size="icon"
          variant={grabando ? "destructive" : "outline"}
          onClick={grabando ? detenerGrabacion : iniciarGrabacion}
          disabled={enviando || transcribiendo}
          className="h-10 w-10 shrink-0"
          title={grabando ? "Detener y enviar" : "Grabar audio"}
        >
          {transcribiendo ? <Loader2 className="h-4 w-4 animate-spin" /> :
           grabando ? <Square className="h-4 w-4 fill-current" /> :
           <Mic className="h-4 w-4" />}
        </Button>
        {/* Botón enviar */}
        <Button type="submit" size="icon" disabled={enviando || grabando || transcribiendo || !texto.trim()} className="h-10 w-10 shrink-0">
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
