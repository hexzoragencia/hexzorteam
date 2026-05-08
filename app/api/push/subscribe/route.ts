import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST: registra una suscripción del dispositivo actual
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const body = await req.json().catch(() => null) as
    | { endpoint?: string; keys?: { p256dh?: string; auth?: string }; userAgent?: string }
    | null;

  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "subscription inválida" }, { status: 400 });
  }

  // Upsert por endpoint (si vuelve a registrarse el mismo dispositivo, actualizamos)
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        perfil_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: body?.userAgent ?? null,
        ultimo_uso: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE: borra una suscripción específica (cuando el user desactiva)
export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

  const body = await req.json().catch(() => null) as { endpoint?: string } | null;
  const endpoint = body?.endpoint;
  if (!endpoint) return NextResponse.json({ error: "falta endpoint" }, { status: 400 });

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("perfil_id", user.id)
    .eq("endpoint", endpoint);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
