"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const MONEDAS = ["COP", "MXN", "USD", "EUR", "CLP"];

function slugify(s: string) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function NuevoEspacioForm({ tipoInicial = "personal" }: { tipoInicial?: "personal" | "empresarial" }) {
  const router = useRouter();
  const supabase = createClient();
  const [tipo, setTipo] = useState<"personal" | "empresarial">(tipoInicial);
  const [nombre, setNombre] = useState("");
  const [moneda, setMoneda] = useState("COP");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (tipo === "personal") {
      if (pin.length < 4) { setError("El PIN debe tener al menos 4 dígitos"); return; }
      if (pin !== pinConfirm) { setError("Los PIN no coinciden"); return; }
      if (!/^\d+$/.test(pin)) { setError("El PIN solo puede tener números"); return; }
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Sesión inválida"); setLoading(false); return; }

    const slugBase = slugify(nombre) || (tipo === "personal" ? "personal" : "empresa");
    const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;

    const { data: espacio, error: e1 } = await supabase.from("espacios").insert({
      slug, nombre, tipo, moneda, created_by: user.id,
    }).select().single();
    if (e1 || !espacio) { setError(e1?.message ?? "Error creando espacio"); setLoading(false); return; }

    const { error: e2 } = await supabase.from("espacio_miembros").insert({
      espacio_id: espacio.id, perfil_id: user.id, rol: "owner",
    });
    if (e2) { setError(e2.message); setLoading(false); return; }

    if (tipo === "personal") {
      const { error: e3 } = await supabase.rpc("set_pin", { esp_id: espacio.id, nuevo_pin: pin });
      if (e3) { setError(`Espacio creado pero falló el PIN: ${e3.message}`); setLoading(false); return; }
    }

    router.push(`/e/${espacio.slug}/dashboard`);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo espacio</CardTitle>
        <CardDescription>Crea un espacio para gestionar finanzas separadas.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={tipo === "personal" ? "default" : "outline"} onClick={() => setTipo("personal")}>
                👤 Personal
              </Button>
              <Button type="button" variant={tipo === "empresarial" ? "default" : "outline"} onClick={() => setTipo("empresarial")}>
                🏢 Empresarial
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {tipo === "personal"
                ? "Privado, solo tú entras con un PIN. Otros miembros del equipo no lo ven."
                : "Compartido entre los miembros del equipo. Sin PIN."}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={tipo === "personal" ? "Mis finanzas" : "Vasecom"}
            />
          </div>

          <div className="space-y-2">
            <Label>Moneda principal</Label>
            <Select value={moneda} onChange={(e) => setMoneda(e.target.value)}>
              {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>

          {tipo === "personal" && (
            <>
              <div className="space-y-2">
                <Label>PIN (4-8 dígitos)</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  required
                  minLength={4}
                  maxLength={8}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirmar PIN</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  required
                  minLength={4}
                  maxLength={8}
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creando..." : "Crear espacio"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
