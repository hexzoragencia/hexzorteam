"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, BellRing, Smartphone, AlertTriangle, Send } from "lucide-react";

type Estado = "cargando" | "no-soportado" | "denegado" | "activo" | "inactivo";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function ActivarNotificaciones() {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okFlash, setOkFlash] = useState<string | null>(null);

  useEffect(() => { detectar(); }, []);

  async function detectar() {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setEstado("no-soportado");
      return;
    }
    if (Notification.permission === "denied") {
      setEstado("denegado");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setEstado(sub ? "activo" : "inactivo");
    } catch {
      setEstado("inactivo");
    }
  }

  async function activar() {
    setWorking(true);
    setError(null);
    setOkFlash(null);
    try {
      // 1. Pedir permiso
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setError("Permiso denegado. Habilítalo desde los ajustes del navegador.");
        setEstado(perm === "denied" ? "denegado" : "inactivo");
        return;
      }

      // 2. Pedir VAPID public key al server
      const r = await fetch("/api/push/vapid-public");
      if (!r.ok) throw new Error("No pude obtener la clave pública VAPID");
      const { key } = await r.json() as { key: string };

      // 3. Suscribir el navegador
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      // 4. Guardar la suscripción en el server
      const subJson = sub.toJSON();
      const save = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          userAgent: navigator.userAgent,
        }),
      });
      if (!save.ok) {
        const e = await save.json().catch(() => ({}));
        throw new Error(e.error || "No pude guardar la suscripción");
      }

      setEstado("activo");
      setOkFlash("Notificaciones activadas en este dispositivo.");

      // 5. Mandar push de prueba
      await fetch("/api/push/test", { method: "POST" }).catch(() => {});
    } catch (e) {
      const err = e as Error;
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  async function desactivar() {
    setWorking(true);
    setError(null);
    setOkFlash(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const ep = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: ep }),
        }).catch(() => {});
      }
      setEstado("inactivo");
      setOkFlash("Notificaciones desactivadas en este dispositivo.");
    } catch (e) {
      const err = e as Error;
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  async function probar() {
    setWorking(true);
    setError(null);
    setOkFlash(null);
    try {
      const r = await fetch("/api/push/test", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No pude enviar");
      if ((d.enviados ?? 0) === 0) {
        setError("No hay dispositivos con notificaciones activas.");
      } else {
        setOkFlash(`Enviado a ${d.enviados} dispositivo${d.enviados === 1 ? "" : "s"}.`);
      }
    } catch (e) {
      const err = e as Error;
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card className={estado === "activo" ? "border-success/40" : ""}>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {estado === "activo" ? (
            <BellRing className="h-4 w-4 text-success" />
          ) : (
            <Bell className="h-4 w-4 text-primary" />
          )}
          Notificaciones al celular
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {estado === "cargando" && (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        )}

        {estado === "no-soportado" && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
            <Smartphone className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              Este navegador no soporta notificaciones push. En iPhone, <b>instala Hexzor en pantalla de inicio</b> (Compartir → Añadir a inicio) y abre desde ahí.
            </div>
          </div>
        )}

        {estado === "denegado" && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-md p-3">
            <BellOff className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              Bloqueaste las notificaciones. Para activarlas, ve a los ajustes del navegador → Permisos → Notificaciones → permitir Hexzor.
            </div>
          </div>
        )}

        {estado === "inactivo" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Recibe avisos en tu celular de tareas, pagos y clases — sin abrir la app.
            </p>
            <p className="text-[11px] text-muted-foreground bg-muted/30 rounded-md p-2 flex items-start gap-2">
              <Smartphone className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                <b>Importante:</b> en iPhone funciona solo si instalas Hexzor en la pantalla de inicio (Compartir → Añadir a inicio) y abres desde ese ícono.
              </span>
            </p>
            <Button onClick={activar} disabled={working}>
              <Bell className="h-4 w-4 mr-1" />
              {working ? "Activando..." : "Activar notificaciones"}
            </Button>
          </div>
        )}

        {estado === "activo" && (
          <div className="space-y-3">
            <p className="text-sm flex items-center gap-2 text-success">
              <BellRing className="h-4 w-4" /> Notificaciones activas en este dispositivo
            </p>
            <p className="text-xs text-muted-foreground">
              Recibirás avisos de tareas próximas, pagos del día y clases de mentoría.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={probar} disabled={working}>
                <Send className="h-3.5 w-3.5 mr-1" /> Enviar prueba
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={desactivar} disabled={working}>
                <BellOff className="h-3.5 w-3.5 mr-1" /> Desactivar
              </Button>
            </div>
          </div>
        )}

        {okFlash && (
          <p className="text-xs text-success bg-success/10 rounded-md p-2">{okFlash}</p>
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
