"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Shield, Smartphone, Copy, Check, AlertTriangle } from "lucide-react";

type Factor = { id: string; status: "verified" | "unverified"; friendly_name?: string };

export function Configurar2FA() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [factores, setFactores] = useState<Factor[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Estado del flujo de activación
  const [activando, setActivando] = useState(false);
  const [enrollData, setEnrollData] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [secretoCopiado, setSecretoCopiado] = useState(false);

  async function cargarFactores() {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    setLoading(false);
    if (error) { setError(error.message); return; }
    // Solo nos interesan los TOTP verificados (los unverified son enrolments incompletos)
    const totp = data.totp ?? [];
    setFactores(totp as Factor[]);
  }

  useEffect(() => { cargarFactores(); }, []);

  async function iniciarActivacion() {
    setActivando(true);
    setError(null);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Hexzor ${new Date().toLocaleDateString("es-CO")}`,
    });
    if (error) {
      setActivando(false);
      setError(error.message);
      return;
    }
    setEnrollData({
      factorId: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
    });
  }

  async function verificarCodigo() {
    if (!enrollData) return;
    if (codigo.length !== 6) { setError("El código debe ser de 6 dígitos"); return; }
    setVerificando(true);
    setError(null);

    // 1. Crear challenge
    const { data: ch, error: errCh } = await supabase.auth.mfa.challenge({ factorId: enrollData.factorId });
    if (errCh || !ch) { setError(errCh?.message ?? "Error creando challenge"); setVerificando(false); return; }

    // 2. Verificar con código
    const { error: errV } = await supabase.auth.mfa.verify({
      factorId: enrollData.factorId,
      challengeId: ch.id,
      code: codigo,
    });
    setVerificando(false);
    if (errV) { setError("Código incorrecto. Verifica que tu app de Authenticator esté en hora."); return; }

    // 3. ¡Listo!
    setActivando(false);
    setEnrollData(null);
    setCodigo("");
    await cargarFactores();
    alert("✅ 2FA activado. La próxima vez que entres te pedirá el código de 6 dígitos.");
  }

  async function cancelarActivacion() {
    if (!enrollData) { setActivando(false); return; }
    // Limpiar el factor unverified
    await supabase.auth.mfa.unenroll({ factorId: enrollData.factorId });
    setActivando(false);
    setEnrollData(null);
    setCodigo("");
    setError(null);
  }

  async function desactivar(factorId: string) {
    if (!confirm("¿Desactivar 2FA? Tu cuenta quedará protegida solo con contraseña. No recomendado.")) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) { setError(error.message); return; }
    await cargarFactores();
    alert("2FA desactivado.");
  }

  async function copiarSecreto() {
    if (!enrollData) return;
    try {
      await navigator.clipboard.writeText(enrollData.secret);
      setSecretoCopiado(true);
      setTimeout(() => setSecretoCopiado(false), 2000);
    } catch { /* ignore */ }
  }

  const tiene2FA = factores.length > 0;

  return (
    <Card className={tiene2FA ? "border-success/40" : ""}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {tiene2FA ? <ShieldCheck className="h-4 w-4 text-success" /> : <Shield className="h-4 w-4 text-primary" />}
          Verificación en 2 pasos (2FA)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : tiene2FA ? (
          <div className="space-y-3">
            <p className="text-sm flex items-center gap-2 text-success">
              <ShieldCheck className="h-4 w-4" /> 2FA está activado
            </p>
            <p className="text-xs text-muted-foreground">
              Cada vez que entres, además de tu contraseña te pediremos un código de 6 dígitos de tu app Authenticator.
            </p>
            {factores.map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
                <div className="text-xs">
                  <div className="font-medium">{f.friendly_name || "Authenticator"}</div>
                  <div className="text-muted-foreground">Activo</div>
                </div>
                <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => desactivar(f.id)}>
                  Desactivar
                </Button>
              </div>
            ))}
          </div>
        ) : !activando ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Protege tu cuenta con un segundo paso de seguridad. Necesitarás una app Authenticator (Google Authenticator, Authy, 1Password, Microsoft Authenticator).
            </p>
            <Button onClick={iniciarActivacion}>
              <Shield className="h-4 w-4 mr-1" /> Activar 2FA
            </Button>
          </div>
        ) : enrollData ? (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/20 p-3 space-y-2">
              <p className="text-xs font-medium">Paso 1: Escanea el QR</p>
              <p className="text-xs text-muted-foreground">
                Abre tu app Authenticator y escanea este código:
              </p>
              <div className="flex justify-center bg-white rounded-md p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={enrollData.qr} alt="QR 2FA" className="w-44 h-44" />
              </div>
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer hover:text-foreground">¿No puedes escanear? Ingresar código manual</summary>
                <div className="flex items-center gap-2 mt-2">
                  <code className="flex-1 px-2 py-1 bg-card border rounded text-[11px] break-all">{enrollData.secret}</code>
                  <Button size="sm" variant="outline" onClick={copiarSecreto}>
                    {secretoCopiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </details>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium">Paso 2: Verifica con un código de tu app</p>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="text-center text-2xl font-mono tracking-[0.5em] h-14"
              />
              <p className="text-[11px] text-muted-foreground text-center">
                Escribe los 6 dígitos que muestra tu app
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={verificarCodigo} disabled={verificando || codigo.length !== 6} className="flex-1">
                {verificando ? "Verificando..." : "Activar 2FA"}
              </Button>
              <Button variant="outline" onClick={cancelarActivacion} disabled={verificando}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Cargando QR...</p>
        )}

        {error && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-md p-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
