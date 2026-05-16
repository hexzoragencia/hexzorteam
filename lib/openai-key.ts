import { createAdminClient } from "@/lib/supabase/admin";

// Devuelve la API key PROPIA del espacio. NO hay fallback a una key global:
// cada espacio debe configurar la suya. Si no tiene → null (la IA no funciona
// hasta que el owner la ponga en Datos del espacio).
// Se lee con el admin client para que la key NUNCA viaje al navegador.
export async function getOpenAIKeyParaEspacio(espacioId: string | null): Promise<string | null> {
  if (!espacioId) return null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("espacios")
      .select("openai_api_key")
      .eq("id", espacioId)
      .maybeSingle();
    const propia = (data?.openai_api_key ?? "").trim();
    return propia.startsWith("sk-") ? propia : null;
  } catch {
    return null;
  }
}
