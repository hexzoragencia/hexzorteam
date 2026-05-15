import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Espacio, EspacioTipo } from "@/lib/types";

export const PIN_COOKIE = (espacioId: string) => `pin_unlock_${espacioId}`;
export const PIN_COOKIE_MAX_AGE = 60 * 60 * 8; // 8 horas

export const VAULT_COOKIE = (espacioId: string) => `vault_unlock_${espacioId}`;

export type VaultState =
  | { state: "unconfigured"; esOwner: boolean }
  | { state: "locked"; esOwner: boolean }
  | { state: "unlocked"; esOwner: boolean };

export async function getVaultState(espacioId: string): Promise<VaultState> {
  const supabase = createClient();
  const user = await getCurrentUser();
  if (!user) return { state: "locked", esOwner: false };

  // Rol del miembro dentro del espacio
  const { data: miembro } = await supabase
    .from("espacio_miembros").select("rol")
    .eq("espacio_id", espacioId).eq("perfil_id", user.id).maybeSingle();

  // Rol global (superadmin vive en perfiles, no en espacio_miembros)
  const { data: perfil } = await supabase
    .from("perfiles").select("rol").eq("id", user.id).maybeSingle();

  const esOwner = miembro?.rol === "owner" || perfil?.rol === "superadmin";

  const { data: esp } = await supabase
    .from("espacios").select("vault_pin_hash").eq("id", espacioId).maybeSingle();

  if (!esp?.vault_pin_hash) return { state: "unconfigured", esOwner };

  const unlocked = cookies().get(VAULT_COOKIE(espacioId))?.value;
  return { state: unlocked ? "unlocked" : "locked", esOwner };
}

export async function getCurrentUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getEspacioBySlug(slug: string): Promise<Espacio | null> {
  const supabase = createClient();
  const { data } = await supabase.from("espacios").select("*").eq("slug", slug).maybeSingle();
  return data as Espacio | null;
}

export async function getMisEspacios(): Promise<Espacio[]> {
  const supabase = createClient();
  const user = await getCurrentUser();
  if (!user) return [];
  // Solo retorna espacios donde el usuario es miembro — aislamiento entre cuentas.
  const { data } = await supabase
    .from("espacios")
    .select("*, espacio_miembros!inner(perfil_id)")
    .eq("espacio_miembros.perfil_id", user.id)
    .order("tipo", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as Espacio[];
}

export async function isSuperAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const supabase = createClient();
  const { data } = await supabase.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  return data?.rol === "superadmin";
}

export async function getEstadoCuenta(): Promise<"pendiente" | "activo" | "rechazado" | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = createClient();
  const { data } = await supabase.from("perfiles").select("estado").eq("id", user.id).maybeSingle();
  return (data?.estado as any) ?? null;
}

/**
 * Resuelve el espacio por slug y verifica acceso completo:
 * - usuario autenticado
 * - usuario es miembro del espacio
 * - si es personal, está desbloqueado por PIN
 *
 * Si falla, hace redirect. Si pasa, devuelve el espacio.
 */
export async function requireEspacio(slug: string): Promise<Espacio> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createClient();

  // Verificar estado de cuenta — usuarios pendientes/rechazados no pueden acceder
  const { data: perfil } = await supabase
    .from("perfiles").select("estado").eq("id", user.id).maybeSingle();
  if (perfil?.estado && perfil.estado !== "activo") redirect("/esperando-aprobacion");

  const espacio = await getEspacioBySlug(slug);
  if (!espacio) redirect("/espacios");

  // Verificar membresía
  const { data: miembro } = await supabase
    .from("espacio_miembros")
    .select("rol")
    .eq("espacio_id", espacio.id)
    .eq("perfil_id", user.id)
    .maybeSingle();
  if (!miembro) redirect("/espacios");

  // PIN check para personal
  if (espacio.tipo === "personal" && espacio.pin_hash) {
    const cookieStore = cookies();
    const unlocked = cookieStore.get(PIN_COOKIE(espacio.id));
    if (!unlocked) redirect(`/desbloquear/${espacio.slug}`);
  }

  return espacio;
}

export function navItems(tipo: EspacioTipo) {
  const base = [
    { href: "dashboard",    label: "Dashboard",    icon: "LayoutDashboard" },
    { href: "transacciones", label: "Transacciones", icon: "Receipt" },
    { href: "presupuesto",  label: "Presupuesto",  icon: "Wallet" },
    { href: "categorias",   label: "Categorías",   icon: "Tags" },
    { href: "fondos",       label: "Ahorros", icon: "PiggyBank" },
    { href: "deudas",       label: "Deudas (Snowball)", icon: "CreditCard" },
  ];
  if (tipo === "empresarial") {
    base.push({ href: "calculadora",   label: "Calculadora",   icon: "Calculator" });
    base.push({ href: "configuracion", label: "Configuración", icon: "Settings" });
  }
  return base;
}
