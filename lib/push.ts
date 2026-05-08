import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

let configured = false;

function configurar() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:hexzoragencia@gmail.com";
  if (!pub || !priv) throw new Error("Faltan VAPID env vars");
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export type PayloadPush = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Envía un push a TODOS los dispositivos (suscripciones) de un perfil.
 * Si una suscripción ya no es válida (410 Gone), la elimina.
 */
export async function enviarPushAPerfil(perfilId: string, payload: PayloadPush) {
  configurar();
  const admin = createAdminClient();

  const { data: subs, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("perfil_id", perfilId);

  if (error) throw error;
  if (!subs || subs.length === 0) return { enviados: 0, fallidos: 0, removidos: 0 };

  const json = JSON.stringify(payload);
  let enviados = 0;
  let fallidos = 0;
  let removidos = 0;

  for (const s of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        },
        json
      );
      enviados++;
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string };
      if (e.statusCode === 404 || e.statusCode === 410) {
        // Suscripción muerta — borrarla
        await admin.from("push_subscriptions").delete().eq("id", s.id);
        removidos++;
      } else {
        fallidos++;
        console.warn("[push] error enviando", e.message, e.statusCode);
      }
    }
  }

  return { enviados, fallidos, removidos };
}
