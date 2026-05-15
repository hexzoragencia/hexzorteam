import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  hashVaultCode,
  isValidCode,
  VAULT_COOKIE,
  VAULT_COOKIE_MAX_AGE,
} from "@/lib/vault";

export async function POST(request: Request) {
  const { espacioId, code } = await request.json();
  if (!espacioId) return NextResponse.json({ error: "espacioId requerido" }, { status: 400 });

  const v = isValidCode(code);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Solo el owner del espacio o el superadmin global puede crear el código.
  const { data: miembro } = await supabase
    .from("espacio_miembros").select("rol")
    .eq("espacio_id", espacioId).eq("perfil_id", user.id).maybeSingle();
  const { data: perfil } = await supabase
    .from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  const esOwner = miembro?.rol === "owner" || perfil?.rol === "superadmin";
  if (!esOwner) {
    return NextResponse.json({ error: "Solo el owner puede configurar la bóveda" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: esp } = await admin.from("espacios").select("vault_pin_hash").eq("id", espacioId).maybeSingle();
  if (esp?.vault_pin_hash) {
    return NextResponse.json({ error: "La bóveda ya tiene código. Usa cambiar código." }, { status: 409 });
  }

  const { hash, salt } = hashVaultCode(code);
  const { error } = await admin.from("espacios").update({
    vault_pin_hash: hash,
    vault_pin_salt: salt,
    vault_failed_attempts: 0,
    vault_locked_until: null,
  }).eq("id", espacioId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-unlock al crear
  cookies().set({
    name: VAULT_COOKIE(espacioId),
    value: "1",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: VAULT_COOKIE_MAX_AGE,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
