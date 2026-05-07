"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, ArrowLeft } from "lucide-react";

export default function RecuperarPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const redirectTo = `${window.location.origin}/cambiar-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setEnviado(true);
  }

  return (
    <main className="min-h-screen grid place-items-center p-4 bg-muted/30">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Image src="/icon.jpg" alt="Hexzor" width={64} height={64} priority />
          <h1 className="text-2xl font-bold tracking-tight">Hexzor</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> Recuperar contraseña
            </CardTitle>
            <CardDescription>
              Te enviamos un correo con un enlace para crear una contraseña nueva.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {enviado ? (
              <div className="space-y-3 text-center">
                <p className="text-sm">
                  ✅ Te enviamos un correo a <b>{email}</b>.
                </p>
                <p className="text-xs text-muted-foreground">
                  Revisa tu bandeja de entrada (y spam por si acaso). Haz click en el link y podrás crear tu contraseña nueva.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/login"><ArrowLeft className="h-4 w-4 mr-1" /> Volver al login</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Tu email</Label>
                  <Input
                    id="email" type="email" required
                    placeholder="tucorreo@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading || !email}>
                  {loading ? "Enviando..." : "Enviar enlace"}
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  <Link href="/login" className="underline">← Volver al login</Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
