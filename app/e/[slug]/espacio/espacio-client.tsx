"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, User, Lock, Save, Check, Trash2, AlertTriangle, Smile, KeyRound, Mail } from "lucide-react";
import type { Espacio } from "@/lib/types";
import { Configurar2FA } from "@/components/configurar-2fa";
import { ActivarNotificaciones } from "@/components/activar-notificaciones";

export function EspacioClient({ espacio, aliasInicial, emailActual }: { espacio: Espacio; aliasInicial: string | null; emailActual: string }) {
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
  // Cambiar email / password
  const [emailNuevo, setEmailNuevo] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  // API key de OpenAI por espacio
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyConfigurada, setApiKeyConfigurada] = useState(false);
  const [apiKeyPista, setApiKeyPista] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState(false);

  useEffect(() => {
    fetch(`/api/espacio/openai-key?espacioId=${espacio.id}`)
      .then(r => r.json())
      .then(j => { setApiKeyConfigurada(!!j.configurada); setApiKeyPista(j.pista ?? null); })
      .catch(() => {});
  }, [espacio.id]);

  async function guardarApiKey() {
    setSavingKey(true);
    const res = await fetch("/api/espacio/openai-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ espacioId: espacio.id, apiKey: apiKeyInput.trim() }),
    });
    const j = await res.json();
    setSavingKey(false);
    if (!res.ok) { alert(j.error ?? "Error"); return; }
    setApiKeyConfigurada(!!j.configurada);
    setApiKeyInput("");
    if (j.configurada) {
      setApiKeyPista("••••" + (apiKeyInput.trim().slice(-4)));
      alert("✅ API key guardada. La IA de este espacio ya usa tu propia cuenta de OpenAI.");
    } else {
      setApiKeyPista(null);
      alert("API key eliminada. Este espacio volverá a usar la key general (si está disponible).");
    }
  }

  async function cambiarEmail() {
    const e = emailNuevo.trim();
    if (!e || !e.includes("@")) { alert("Email inválido"); return; }
    if (e === emailActual) { alert("Ese ya es tu email actual"); return; }
    if (!confirm(`¿Cambiar tu email a "${e}"? Te enviaremos un correo de confirmación al nuevo email — debes hacer click en el link para que el cambio se aplique.`)) return;
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: e });
    setSavingEmail(false);
    if (error) { alert(error.message); return; }
    alert("Listo. Te enviamos un correo de confirmación al email nuevo. Revisa tu bandeja y haz click en el link para activar el cambio.");
    setEmailNuevo("");
  }

  async function cambiarPassword() {
    const p = passwordNueva;
    if (p.length < 6) { alert("La contraseña debe tener al menos 6 caracteres"); return; }
    if (p !== passwordConfirm) { alert("Las contraseñas no coinciden"); return; }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: p });
    setSavingPwd(false);
    if (error) { alert(error.message); return; }
    alert("✅ Contraseña actualizada. La próxima vez que entres usa la nueva.");
    setPasswordNueva(""); setPasswordConfirm("");
  }

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

      {/* Mi cuenta — cambiar email / password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Mi cuenta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Email actual + cambiar */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Email actual
            </label>
            <div className="text-sm font-mono bg-muted/30 rounded-md px-3 py-2 border">{emailActual}</div>
            <div className="flex gap-2 pt-1">
              <Input
                type="email"
                placeholder="Nuevo email (ej: nuevo@correo.com)"
                value={emailNuevo}
                onChange={(e) => setEmailNuevo(e.target.value)}
              />
              <Button onClick={cambiarEmail} disabled={savingEmail || !emailNuevo}>
                {savingEmail ? "Enviando..." : "Cambiar"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Recibirás un correo de confirmación en el email nuevo. Hasta que confirmes ahí, sigues entrando con el email actual.</p>
          </div>

          {/* Cambiar contraseña */}
          <div className="space-y-1.5 pt-3 border-t">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" /> Cambiar contraseña
            </label>
            <Input
              type="password"
              placeholder="Nueva contraseña (mín 6 caracteres)"
              value={passwordNueva}
              onChange={(e) => setPasswordNueva(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Confirma la nueva contraseña"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
            <Button
              onClick={cambiarPassword}
              disabled={savingPwd || !passwordNueva || passwordNueva !== passwordConfirm || passwordNueva.length < 6}
            >
              {savingPwd ? "Guardando..." : "Cambiar contraseña"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API de IA — clave propia de OpenAI */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> API de IA (OpenAI)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Para usar el coach IA, las capturas, audios y todas las herramientas inteligentes,
            este espacio necesita una API key de OpenAI. Cada espacio usa su propia clave
            (así cada quien paga su propio consumo).
          </p>

          <div className={`rounded-lg border px-3 py-2 text-sm flex items-center gap-2 ${
            apiKeyConfigurada ? "border-success/40 bg-success/5 text-success" : "border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400"
          }`}>
            {apiKeyConfigurada ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {apiKeyConfigurada
              ? <span>API key configurada {apiKeyPista && <span className="font-mono opacity-70">({apiKeyPista})</span>} — la IA está activa.</span>
              : <span>Sin API key propia. La IA usará la clave general si está disponible.</span>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              {apiKeyConfigurada ? "Reemplazar API key" : "Pega tu API key de OpenAI"}
            </label>
            <Input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="sk-..."
              className="font-mono h-10"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              La obtienes en <span className="font-mono">platform.openai.com/api-keys</span>.
              Se guarda cifrada en el servidor y nunca se muestra completa.
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={guardarApiKey} disabled={savingKey || (!apiKeyInput.trim() && !apiKeyConfigurada)}>
              <Save className="h-4 w-4 mr-1" />
              {savingKey ? "Guardando…" : "Guardar API key"}
            </Button>
            {apiKeyConfigurada && (
              <Button
                variant="outline"
                onClick={() => { setApiKeyInput(""); guardarApiKey(); }}
                disabled={savingKey}
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-1" /> Quitar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notificaciones push */}
      <ActivarNotificaciones />

      {/* 2FA — Verificación en 2 pasos */}
      <Configurar2FA />

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
