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

/** Preferencias específicas del espacio actual.
 * Si el usuario configuró apariencia para ese espacio, retorna esas.
 * Si no, fallback a las preferencias globales del usuario.
 */
export async function getPreferenciasEspacio(espacioId: string): Promise<Preferencias> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return PREFS_DEFAULT;

    // Intentar leer las del espacio
    const { data: esp } = await supabase
      .from("preferencias_espacio")
      .select("tema, fuente, modo, densidad")
      .eq("perfil_id", user.id)
      .eq("espacio_id", espacioId)
      .maybeSingle();
    if (esp) return esp as Preferencias;

    // Fallback a las globales del usuario
    const { data: globales } = await supabase
      .from("preferencias_usuario")
      .select("tema, fuente, modo, densidad")
      .eq("perfil_id", user.id)
      .maybeSingle();
    if (globales) return globales as Preferencias;

    return PREFS_DEFAULT;
  } catch {
    return PREFS_DEFAULT;
  }
}
