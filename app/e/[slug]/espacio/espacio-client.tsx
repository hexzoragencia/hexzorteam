"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, User, Lock, Save, Check, Trash2, AlertTriangle, Smile } from "lucide-react";
import type { Espacio } from "@/lib/types";

export function EspacioClient({ espacio, aliasInicial }: { espacio: Espacio; aliasInicial: string | null }) {
  const router = useRouter();
  const supabase = createClient();
  const [nombre, setNombre] = useState(espacio.nombre);
  const [moneda, setMoneda] = useState(espacio.moneda);
  const [alias, setAlias] = useState(aliasInicial ?? "");
  const [pinNuevo, setPinNuevo] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [borrando, setBorrando] = useState(false);

  const dirty = nombre.trim() !== espacio.nombre || moneda !== espacio.moneda || alias.trim() !== (aliasInicial ?? "");

  async function eliminarEspacio() {
    if (confirmText !== espacio.nombre) {
      alert(`Para eliminar, escribe exactamente: ${espacio.nombre}`);
      return;
    }
    if (!confirm(`¿Estás 100% seguro? Se borrará "${espacio.nombre}" y TODAS sus transacciones, categorías, presupuestos, ahorros, deudas y configuración. NO se puede deshacer.`)) return;
    setBorrando(true);
    const { error } = await supabase.from("espacios").delete().eq("id", espacio.id);
    if (error) { alert(error.message); setBorrando(false); return; }
    router.push("/espacios");
    router.refresh();
  }

  async function guardar() {
    const n = nombre.trim();
    if (!n) { alert("El nombre no puede estar vacío"); return; }
    setSaving(true);
    const { error } = await supabase.from("espacios").update({ nombre: n, moneda }).eq("id", espacio.id);
    if (error) { alert(error.message); setSaving(false); return; }
    // Guardar alias del miembro
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const aliasClean = alias.trim() || null;
      await supabase.from("espacio_miembros").update({ alias: aliasClean })
        .eq("espacio_id", espacio.id).eq("perfil_id", user.id);
    }
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
    router.refresh();
  }

  async function cambiarPin() {
    if (!pinNuevo || pinNuevo.length < 4 || pinNuevo.length > 8 || !/^\d+$/.test(pinNuevo)) {
      alert("El PIN debe ser entre 4 y 8 dígitos numéricos");
      return;
    }
    const { error } = await supabase.rpc("set_pin", { esp_id: espacio.id, nuevo_pin: pinNuevo });
    if (error) { alert(error.message); return; }
    setPinNuevo("");
    alert("PIN actualizado. La próxima vez que entres se te pedirá el nuevo.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          {espacio.tipo === "empresarial" ? <Building2 className="h-7 w-7 text-primary" /> : <User className="h-7 w-7 text-primary" />}
          Configuración del espacio
        </h1>
        <p className="text-muted-foreground text-sm">Edita el nombre, la moneda y la seguridad de este espacio.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Datos generales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Nombre del espacio</label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Vasecom · Personal Victor · Empresa X"
            />
            <p className="text-xs text-muted-foreground">Cómo se ve en el menú lateral y en el selector de espacios.</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Smile className="h-3.5 w-3.5 text-primary" /> ¿Cómo quieres que te llamen aquí?
            </label>
            <Input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="Ej. Victor · Vic · Jefe · Boss"
              maxLength={40}
            />
            <p className="text-xs text-muted-foreground">El Coach IA y el dashboard te saludarán con este alias en este espacio. Si lo dejas vacío usará tu nombre real.</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Moneda</label>
            <select
              className="h-11 w-full rounded-md border border-input bg-background px-3"
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
            >
              <option value="COP">🇨🇴 COP — Peso colombiano</option>
              <option value="MXN">🇲🇽 MXN — Peso mexicano</option>
              <option value="USD">🇺🇸 USD — Dólar</option>
              <option value="EUR">🇪🇸 EUR — Euro</option>
              <option value="CLP">🇨🇱 CLP — Peso chileno</option>
            </select>
            <p className="text-xs text-muted-foreground">Define cómo se formatean los montos en este espacio.</p>
          </div>

          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>Tipo: <span className="font-medium text-foreground">{espacio.tipo === "empresarial" ? "Empresarial (compartido)" : "Personal (privado con PIN)"}</span></div>
            <div>Slug: <span className="font-mono">{espacio.slug}</span></div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={guardar} disabled={!dirty || saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando..." : savedFlash ? "✓ Guardado" : "Guardar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Zona de peligro — eliminar espacio */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" /> Zona peligrosa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Eliminar este espacio borrará permanentemente <b>todas sus transacciones, categorías, presupuestos, ahorros, deudas, hábitos, objetivos y planeación</b>. Esta acción no se puede deshacer.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Para confirmar, escribe exactamente: <span className="font-mono font-medium text-foreground">{espacio.nombre}</span></label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={espacio.nombre}
              className="border-destructive/40"
            />
          </div>
          <Button
            variant="destructive"
            onClick={eliminarEspacio}
            disabled={confirmText !== espacio.nombre || borrando}
          >
            <Trash2 className="h-4 w-4 mr-1" /> {borrando ? "Eliminando..." : "Eliminar este espacio"}
          </Button>
        </CardContent>
      </Card>

      {/* Cambiar PIN solo en personales */}
      {espacio.tipo === "personal" && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" /> Seguridad — PIN de acceso</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Tu espacio personal está protegido con un PIN. Solo tú puedes entrar después de meterlo. Sesión de 8 horas.
            </p>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">PIN nuevo (4-8 dígitos)</label>
              <Input
                type="password" inputMode="numeric" pattern="[0-9]*"
                value={pinNuevo}
                onChange={(e) => setPinNuevo(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="••••"
                maxLength={8}
              />
            </div>
            <Button onClick={cambiarPin} disabled={!pinNuevo || pinNuevo.length < 4}>
              <Check className="h-4 w-4 mr-1" /> Cambiar PIN
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
