"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, KeyRound, Eye, EyeOff, ArrowRight } from "lucide-react";

export function VaultUnlock({ espacioId, esOwner }: {
  espacioId: string; slug: string; esOwner: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  async function submit() {
    if (!code) return;
    setError(null);
    setLoading(true);
    const res = await fetch("/api/vault/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ espacioId, code }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Código incorrecto");
      setCode("");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    router.refresh();
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className={`max-w-md w-full space-y-8 ${shake ? "animate-shake" : ""}`}>
        <div className="text-center space-y-3">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl animate-pulse"></div>
            <Lock className="h-10 w-10 text-primary relative" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Bóveda bloqueada</h1>
          <p className="text-muted-foreground text-sm">
            Ingresa el código de acceso para desbloquear las credenciales del equipo.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type={show ? "text" : "password"}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="••••••"
                autoFocus
                autoComplete="off"
                className="w-full h-14 pl-12 pr-12 rounded-xl border border-input bg-card font-mono text-xl tracking-[0.3em] text-center focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-muted text-muted-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2 text-center">
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading || !code}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            {loading ? "Verificando..." : (
              <>Desbloquear <ArrowRight className="h-4 w-4" /></>
            )}
          </button>

          <div className="text-xs text-muted-foreground text-center pt-2">
            <p>🔒 Sesión desbloqueada por 30 minutos.</p>
            {esOwner && <p className="mt-1">Tras 5 intentos fallidos, la bóveda se bloquea 15 min.</p>}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .animate-shake { animation: shake 0.4s; }
      `}</style>
    </div>
  );
}
