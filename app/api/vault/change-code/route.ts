import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  hashVaultCode,
  verifyVaultCode,
  isValidCode,
  VAULT_COOKIE,
  VAULT_COOKIE_MAX_AGE,
} from "@/lib/vault";

export async function POST(request: Request) {
  const { espacioId, currentCode, newCode } = await request.json();
  if (!espacioId) return NextResponse.json({ error: "espacioId requerido" }, { status: 400 });

  const v = isValidCode(newCode);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: miembro } = await supabase
    .from("espacio_miembros").select("rol")
    .eq("espacio_id", espacioId).eq("perfil_id", user.id).maybeSingle();
  if (!miembro || (miembro.rol !== "owner" && miembro.rol !== "superadmin")) {
    return NextResponse.json({ error: "Solo el owner puede cambiar el código" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: esp } = await admin.from("espacios")
    .select("vault_pin_hash, vault_pin_salt").eq("id", espacioId).maybeSingle();
  if (!esp?.vault_pin_hash) {
    return NextResponse.json({ error: "La bóveda no está configurada" }, { status: 409 });
  }

  if (!verifyVaultCode(currentCode ?? "", esp.vault_pin_hash, esp.vault_pin_salt!)) {
    return NextResponse.json({ error: "El código actual es incorrecto" }, { status: 401 });
  }

  const { hash, salt } = hashVaultCode(newCode);
  const { error } = await admin.from("espacios").update({
    vault_pin_hash: hash,
    vault_pin_salt: salt,
    vault_failed_attempts: 0,
    vault_locked_until: null,
  }).eq("id", espacioId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Refresca la cookie de unlock con el nuevo código activo
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
