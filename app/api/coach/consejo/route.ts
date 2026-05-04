import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { recolectarContexto } from "@/lib/coach";
import { hoyIso } from "@/lib/fechas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Eres un coach personal del usuario VICTOR ROSSO, dropshipper de Vasecom (productos en CO/MX/EC/ES/CL).
Hablas español colombiano, directo, amigable pero brutalmente honesto cuando hay que serlo. Eres su entrenador, no su amigo complaciente.

Tu trabajo: cada día le das un saludo, una frase corta motivacional o bíblica relevante a su situación, y un análisis breve de:
- Sus fortalezas (qué está haciendo bien)
- Sus debilidades (qué está fallando)
- Una sugerencia concreta para hoy

Tono: cercano, sin sermones largos. Como un mentor que lo conoce. Usa "tú" no "usted".
Si está fallando, dilo claro pero con amor. Si está bien, felicítalo sin exagerar.

NUNCA inventes datos. Solo usa los que te paso. Si no hay datos suficientes en alguna área, omítela en vez de inventar.`;

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

    const url = new URL("dummy", "http://x");
    const espacioId = (await getEspacioPersonal(supabase, user.id));
    if (!espacioId) return NextResponse.json({ error: "no espacio personal" }, { status: 404 });

    const fecha = hoyIso();

    // Verificar cache
    const { data: cached } = await supabase.from("coach_consejos")
      .select("*").eq("espacio_id", espacioId).eq("perfil_id", user.id).eq("fecha", fecha).maybeSingle();
    if (cached) {
      return NextResponse.json({
        saludo: cached.saludo, frase: cached.frase,
        fortalezas: cached.fortalezas, debilidades: cached.debilidades,
        sugerencia: cached.sugerencia, cached: true,
      });
    }

    // Recolectar contexto
    const ctx = await recolectarContexto(supabase, espacioId);
    const ctxStr = JSON.stringify(ctx, null, 2);

    // Llamar OpenAI con structured output
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Contexto del usuario hoy:\n${ctxStr}\n\nDevuélveme JSON con: saludo (saludo del día con su nombre), frase (una frase motivacional o bíblica corta y relevante), fortalezas (1 frase corta sobre qué está haciendo bien), debilidades (1 frase sobre qué falta), sugerencia (1 acción concreta para hoy). Cada campo máximo 25 palabras. Sé específico con los números cuando aplique.` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 500,
    });

    const text = completion.choices[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { /* ignore */ }

    const consejo = {
      saludo: String(parsed.saludo ?? "").slice(0, 200),
      frase: String(parsed.frase ?? "").slice(0, 250),
      fortalezas: String(parsed.fortalezas ?? "").slice(0, 250),
      debilidades: String(parsed.debilidades ?? "").slice(0, 250),
      sugerencia: String(parsed.sugerencia ?? "").slice(0, 250),
    };

    // Guardar cache
    await supabase.from("coach_consejos").upsert({
      espacio_id: espacioId, perfil_id: user.id, fecha,
      ...consejo, generado_at: new Date().toISOString(),
    });

    return NextResponse.json({ ...consejo, cached: false });
  } catch (e: any) {
    console.error("consejo error:", e);
    return NextResponse.json({ error: e.message ?? "error" }, { status: 500 });
  }
}

// Forzar regeneración (para botón "actualizar")
export async function POST() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });
    const espacioId = await getEspacioPersonal(supabase, user.id);
    if (!espacioId) return NextResponse.json({ error: "no espacio personal" }, { status: 404 });
    await supabase.from("coach_consejos").delete().eq("espacio_id", espacioId).eq("perfil_id", user.id).eq("fecha", hoyIso());
    return GET();
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "error" }, { status: 500 });
  }
}

async function getEspacioPersonal(sb: any, userId: string): Promise<string | null> {
  const { data } = await sb.from("espacios").select("id, tipo, espacio_miembros!inner(perfil_id)")
    .eq("tipo", "personal").eq("espacio_miembros.perfil_id", userId).maybeSingle();
  return data?.id ?? null;
}
