import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enviarPushAPerfil } from "@/lib/push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST: envía una notificación de prueba al usuario actual
export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  try {
    const r = await enviarPushAPerfil(user.id, {
      title: "🎉 ¡Hexzor conectado!",
      body: "Listo, las notificaciones están activas en este dispositivo.",
      url: "/espacios",
      tag: "hexzor-test",
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
