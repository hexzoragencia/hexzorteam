import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  verifyVaultCode,
  VAULT_COOKIE,
  VAULT_COOKIE_MAX_AGE,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_MINUTES,
} from "@/lib/vault";

export async function POST(request: Request) {
  const { espacioId, code } = await request.json();
  if (!espacioId || typeof code !== "string") {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Verifica membresía (la RLS también lo haría, pero respondemos rápido).
  const { data: miembro } = await supabase
    .from("espacio_miembros").select("rol")
    .eq("espacio_id", espacioId).eq("perfil_id", user.id).maybeSingle();
  if (!miembro) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const admin = createAdminClient();
  const { data: esp } = await admin.from("espacios")
    .select("vault_pin_hash, vault_pin_salt, vault_failed_attempts, vault_locked_until")
    .eq("id", espacioId).maybeSingle();

  if (!esp?.vault_pin_hash) {
    return NextResponse.json({ error: "La bóveda no ha sido configurada" }, { status: 409 });
  }

  // Lockout activo?
  if (esp.vault_locked_until && new Date(esp.vault_locked_until) > new Date()) {
    const min = Math.ceil((new Date(esp.vault_locked_until).getTime() - Date.now()) / 60000);
    return NextResponse.json({
      error: `Demasiados intentos. Intenta de nuevo en ${min} min.`,
      lockedUntil: esp.vault_locked_until,
    }, { status: 429 });
  }

  const ok = verifyVaultCode(code, esp.vault_pin_hash, esp.vault_pin_salt!);

  const hdrs = headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0].trim() || null;
  const ua = hdrs.get("user-agent") || null;

  // Audit log (mejor esfuerzo, no bloquea si falla)
  admin.from("vault_unlock_log").insert({
    espacio_id: espacioId, perfil_id: user.id, exito: ok, ip, user_agent: ua,
  }).then(() => {});

  if (!ok) {
    const attempts = (esp.vault_failed_attempts ?? 0) + 1;
    const update: any = { vault_failed_attempts: attempts };
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      update.vault_locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString();
      update.vault_failed_attempts = 0;
    }
    await admin.from("espacios").update(update).eq("id", espacioId);
    const restantes = MAX_FAILED_ATTEMPTS - attempts;
    return NextResponse.json({
      error: restantes > 0
        ? `Código incorrecto. ${restantes} intento${restantes === 1 ? "" : "s"} restante${restantes === 1 ? "" : "s"}.`
        : `Demasiados intentos. Bóveda bloqueada ${LOCKOUT_MINUTES} min.`,
    }, { status: 401 });
  }

  // Reset contador
  await admin.from("espacios").update({
    vault_failed_attempts: 0,
    vault_locked_until: null,
  }).eq("id", espacioId);

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
