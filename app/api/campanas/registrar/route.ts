import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { registrarCampana } from "@/lib/campanas";

export async function POST(request: Request) {
  const body = await request.json();
  const { espacioId, ...datos } = body;
  if (!espacioId || !datos?.fecha) {
    return NextResponse.json({ error: "Faltan datos (espacioId, fecha)" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Verificar membresía del espacio
  const { data: miembro } = await supabase
    .from("espacio_miembros").select("rol")
    .eq("espacio_id", espacioId).eq("perfil_id", user.id).maybeSingle();
  if (!miembro) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const r = await registrarCampana(supabase, espacioId, datos);
    return NextResponse.json({ ok: true, ...r });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Error" }, { status: 500 });
  }
}
