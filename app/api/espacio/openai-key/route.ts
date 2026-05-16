import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET: estado de la key (¿configurada? sin revelarla)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const espacioId = searchParams.get("espacioId");
  if (!espacioId) return NextResponse.json({ error: "espacioId requerido" }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: miembro } = await supabase
    .from("espacio_miembros").select("rol")
    .eq("espacio_id", espacioId).eq("perfil_id", user.id).maybeSingle();
  if (!miembro) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const admin = createAdminClient();
  const { data } = await admin.from("espacios").select("openai_api_key").eq("id", espacioId).maybeSingle();
  const key = (data?.openai_api_key ?? "").trim();
  return NextResponse.json({
    configurada: key.startsWith("sk-"),
    // Solo mostramos los últimos 4 caracteres como pista, nunca la key completa.
    pista: key ? `••••${key.slice(-4)}` : null,
  });
}

// POST: guardar / actualizar la key (solo owner). Manda key vacía para borrarla.
export async function POST(request: Request) {
  const { espacioId, apiKey } = await request.json();
  if (!espacioId) return NextResponse.json({ error: "espacioId requerido" }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: miembro } = await supabase
    .from("espacio_miembros").select("rol")
    .eq("espacio_id", espacioId).eq("perfil_id", user.id).maybeSingle();
  const { data: perfil } = await supabase
    .from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  const esOwner = miembro?.rol === "owner" || perfil?.rol === "superadmin";
  if (!esOwner) {
    return NextResponse.json({ error: "Solo el owner puede configurar la API key" }, { status: 403 });
  }

  const limpia = String(apiKey ?? "").trim();
  if (limpia && !limpia.startsWith("sk-")) {
    return NextResponse.json({ error: "La API key de OpenAI debe empezar con 'sk-'" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("espacios")
    .update({ openai_api_key: limpia || null }).eq("id", espacioId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, configurada: !!limpia });
}
