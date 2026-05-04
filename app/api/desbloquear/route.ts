import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { PIN_COOKIE, PIN_COOKIE_MAX_AGE } from "@/lib/espacio";

export async function POST(request: Request) {
  const { espacioId } = await request.json();
  if (!espacioId) return NextResponse.json({ error: "espacioId requerido" }, { status: 400 });

  // Verificar que el usuario es miembro del espacio (defensa en profundidad)
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: miembro } = await supabase
    .from("espacio_miembros")
    .select("rol")
    .eq("espacio_id", espacioId)
    .eq("perfil_id", user.id)
    .maybeSingle();
  if (!miembro) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  cookies().set({
    name: PIN_COOKIE(espacioId),
    value: "1",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: PIN_COOKIE_MAX_AGE,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
