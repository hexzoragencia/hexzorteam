"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado para flujo 2FA (cuando el user tiene MFA activo)
  const [necesita2fa, setNecesita2fa] = useState(false);
  const [factor2fa, setFactor2fa] = useState<{ id: string } | null>(null);
  const [codigo2fa, setCodigo2fa] = useState("");

  async function continuarLogin() {
    // Después de pasar 2FA o si no se requiere, verificar estado y redirigir
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: perfil } = await supabase.from("perfiles").select("estado").eq("id", user.id).maybeSingle();
      if (perfil?.estado === "pendiente") {
        router.push("/esperando-aprobacion");
        return;
      }
      if (perfil?.estado === "rechazado") {
        await supabase.auth.signOut();
        setError("Tu solicitud de acceso fue rechazada. Contacta al administrador.");
        setLoading(false);
        return;
      }
    }
    router.push("/");
    router.refresh();
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }

    // Después del password, verificar si requiere 2FA
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      // El user tiene 2FA activo pero solo pasó password
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = (factors?.totp ?? [])[0];
      if (totpFactor) {
        setFactor2fa({ id: totpFactor.id });
        setNecesita2fa(true);
        setLoading(false);
        return;
      }
    }

    await continuarLogin();
  };

  async function verificar2fa(e: React.FormEvent) {
    e.preventDefault();
    if (!factor2fa) return;
    if (codigo2fa.length !== 6) { setError("Código de 6 dígitos"); return; }
    setLoading(true);
    setError(null);
    const { data: ch, error: errCh } = await supabase.auth.mfa.challenge({ factorId: factor2fa.id });
    if (errCh || !ch) { setError(errCh?.message ?? "Error en challenge"); setLoading(false); return; }
    const { error: errV } = await supabase.auth.mfa.verify({
      factorId: factor2fa.id,
      challengeId: ch.id,
      code: codigo2fa,
    });
    if (errV) { setError("Código incorrecto. Verifica que tu app esté en hora."); setLoading(false); return; }
    await continuarLogin();
  }

  return (
    <main className="min-h-screen grid place-items-center p-4 bg-muted/30">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Image src="/icon.jpg" alt="Hexzor" width={64} height={64} priority />
          <h1 className="text-2xl font-bold tracking-tight">Hexzor Empresarial</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{necesita2fa ? "Verificación 2FA" : "Iniciar sesión"}</CardTitle>
            <CardDescription>
              {necesita2fa
                ? "Escribe el código de 6 dígitos de tu app Authenticator"
                : "Entra al panel de Hexzorteam"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!necesita2fa ? (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
                <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
                  <Link href="/recuperar-password" className="underline hover:text-primary">¿Olvidaste tu contraseña?</Link>
                  <span>¿No tienes cuenta? <Link href="/register" className="underline">Regístrate</Link></span>
                </div>
              </form>
            ) : (
              <form onSubmit={verificar2fa} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo2fa">Código de 6 dígitos</Label>
                  <Input
                    id="codigo2fa"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    required
                    value={codigo2fa}
                    onChange={(e) => setCodigo2fa(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="text-center text-2xl font-mono tracking-[0.5em] h-14"
                    placeholder="000000"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading || codigo2fa.length !== 6}>
                  {loading ? "Verificando..." : "Verificar y entrar"}
                </Button>
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setNecesita2fa(false);
                    setFactor2fa(null);
                    setCodigo2fa("");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground w-full text-center"
                >
                  ← Cancelar y volver al login
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
