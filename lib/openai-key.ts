import { createAdminClient } from "@/lib/supabase/admin";

// Resuelve qué API key de OpenAI usar para un espacio:
// 1) la propia del espacio (espacios.openai_api_key) si está configurada
// 2) si no, la global del servidor (process.env.OPENAI_API_KEY)
// Se lee con el admin client para que la key NUNCA viaje al navegador.
export async function getOpenAIKeyParaEspacio(espacioId: string | null): Promise<string | null> {
  const global = process.env.OPENAI_API_KEY ?? null;
  if (!espacioId) return global;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("espacios")
      .select("openai_api_key")
      .eq("id", espacioId)
      .maybeSingle();
    const propia = (data?.openai_api_key ?? "").trim();
    if (propia.startsWith("sk-")) return propia;
    return global;
  } catch {
    return global;
  }
}
