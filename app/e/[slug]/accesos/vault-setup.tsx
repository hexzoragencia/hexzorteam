"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, KeyRound, Eye, EyeOff, ArrowRight, ShieldAlert } from "lucide-react";

export function VaultSetup({ espacioId, slug, esOwner }: {
  espacioId: string; slug: string; esOwner: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!esOwner) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-semibold">Bóveda sin configurar</h1>
          <p className="text-muted-foreground text-sm">
            El owner del espacio aún no ha creado el código de acceso a la bóveda.
            Pídele que lo configure desde esta sección.
          </p>
        </div>
      </div>
    );
  }

  async function submit() {
    setError(null);
    if (code.length < 4) { setError("El código debe tener al menos 4 caracteres"); return; }
    if (code !== confirm) { setError("Los códigos no coinciden"); return; }
    setLoading(true);
    const res = await fetch("/api/vault/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ espacioId, code }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json.error ?? "Error al configurar"); return; }
    router.refresh();
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center relative">
            <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl"></div>
            <ShieldCheck className="h-10 w-10 text-primary relative" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Configura tu bóveda</h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-sm mx-auto">
            Crea un código secreto para proteger las credenciales del equipo.
            Cualquier miembro que sepa este código podrá entrar.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Código de bóveda
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={show ? "text" : "password"}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Mín. 4 caracteres"
                autoFocus
                className="w-full h-12 pl-10 pr-12 rounded-xl border border-input bg-card font-mono text-lg tracking-wider focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
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

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Confirma el código
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repítelo"
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="w-full h-12 pl-10 rounded-xl border border-input bg-card font-mono text-lg tracking-wider focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading || !code || !confirm}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            {loading ? "Configurando..." : (
              <>Crear bóveda <ArrowRight className="h-4 w-4" /></>
            )}
          </button>

          <div className="text-xs text-muted-foreground text-center space-y-1 pt-2">
            <p>🔒 El código se guarda hasheado (scrypt). No lo recuperamos si lo pierdes.</p>
            <p>Comparte el código solo con miembros de confianza.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
