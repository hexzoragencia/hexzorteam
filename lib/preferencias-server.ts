import { createClient } from "@/lib/supabase/server";
import { PREFS_DEFAULT, type Preferencias } from "@/lib/apariencia";

export async function getPreferenciasUsuario(): Promise<Preferencias> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return PREFS_DEFAULT;
    const { data, error } = await supabase
      .from("preferencias_usuario")
      .select("tema, fuente, modo, densidad")
      .eq("perfil_id", user.id)
      .maybeSingle();
    if (error || !data) return PREFS_DEFAULT;
    return data as Preferencias;
  } catch {
    // tabla aún no existe (migración pendiente) — uso defaults
    return PREFS_DEFAULT;
  }
}
