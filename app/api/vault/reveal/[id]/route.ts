import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { VAULT_COOKIE } from "@/lib/vault";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  // Trae el acceso (RLS filtra a miembros del espacio).
  const { data: acceso } = await supabase
    .from("emp_accesos")
    .select("id, espacio_id, password_enc")
    .eq("id", params.id)
    .maybeSingle();
  if (!acceso) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Verifica cookie de unlock para ESTE espacio.
  const unlocked = cookies().get(VAULT_COOKIE(acceso.espacio_id))?.value;
  if (!unlocked) return NextResponse.json({ error: "Bóveda bloqueada" }, { status: 423 });

  return NextResponse.json({ password: acceso.password_enc ?? "" });
}
