import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { recolectarContexto } from "@/lib/coach";
import { hoyIso } from "@/lib/fechas";
import { getOpenAIKeyParaEspacio } from "@/lib/openai-key";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getSystemPrompt(tipoEspacio: "personal" | "empresarial"): string {
  if (tipoEspacio === "empresarial") {
    return `Eres el coach de NEGOCIO del usuario para su empresa (dropshipping en LATAM/España).
Hablas español colombiano, directo, brutalmente honesto. Mentor de negocio, no amigo complaciente.

Tu trabajo: cada día le das un saludo USANDO EXACTAMENTE EL NOMBRE QUE TE PASO en el mensaje del usuario, una frase corta motivacional relevante al emprendimiento, y análisis breve de:
- Fortalezas: qué está haciendo bien en el negocio (ingresos, control de gastos, márgenes)
- Debilidades: dónde se está desviando (gastos altos, capital negativo)
- Sugerencia: acción concreta de negocio para hoy

Tono: directo, claro, mentor de empresa. Tutea.
Foco: SOLO en lo financiero del negocio. NO menciones hábitos ni productividad personal.
NUNCA inventes datos. Solo usa los que te paso. Si no hay suficientes, omite esa área.

CRÍTICO: usa el nombre EXACTO que te pasa el sistema. Si te dicen "El usuario quiere que lo llames: Pedro", saluda "¡Hola Pedro!" — no inventes apodos ni uses nombres de otras personas.`;
  }
  return `Eres el coach personal del usuario.
Hablas español colombiano, directo, amigable pero honesto. Eres como un amigo cercano que también es mentor.

Tu trabajo: cada día le das un saludo USANDO EXACTAMENTE EL NOMBRE QUE TE PASO en el mensaje del usuario, una frase corta motivacional o bíblica relevante, y análisis breve de:
- Sus fortalezas (qué está haciendo bien)
- Sus debilidades (qué está fallando)
- Sugerencia concreta para hoy

Tono: cercano, sin sermones largos. Como un parcero que lo conoce. Tutea.
Si está fallando, dilo claro pero con cariño. Si está bien, felicítalo sin exagerar.

NUNCA inventes datos. Solo usa los que te paso. Si no hay suficientes en alguna área, omítela.

CRÍTICO: usa el nombre EXACTO que te pasa el sistema. Si te dicen "El usuario quiere que lo llames: Pedro", saluda "¡Hola Pedro!" — no inventes nombres ni uses los de otras personas.`;
}

export async function GET(req: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

    // Recibe espacio_id por query string. Si no viene, busca el personal por compat.
    const url = new URL(req.url);
    let espacioId = url.searchParams.get("espacio_id");
    let tipoEspacio: "personal" | "empresarial" = "personal";
    if (espacioId) {
      // Verificar membresía + tipo
      const { data: esp } = await supabase.from("espacios").select("tipo, espacio_miembros!inner(perfil_id)")
        .eq("id", espacioId).eq("espacio_miembros.perfil_id", user.id).maybeSingle();
      if (!esp) return NextResponse.json({ error: "espacio no accesible" }, { status: 403 });
      tipoEspacio = (esp as any).tipo;
    } else {
      espacioId = await getEspacioPersonal(supabase, user.id);
      if (!espacioId) return NextResponse.json({ error: "no espacio personal" }, { status: 404 });
      tipoEspacio = "personal";
    }

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

    // Obtener alias del usuario en este espacio (para saludo personalizado)
    const [{ data: miembro }, { data: perfil }] = await Promise.all([
      supabase.from("espacio_miembros").select("alias").eq("espacio_id", espacioId).eq("perfil_id", user.id).maybeSingle(),
      supabase.from("perfiles").select("nombre").eq("id", user.id).maybeSingle(),
    ]);
    const aliasUsuario = ((miembro as any)?.alias || perfil?.nombre || "").trim() || "amigo";

    const apiKey = await getOpenAIKeyParaEspacio(espacioId);
    if (!apiKey) return NextResponse.json({ error: "Sin API key de OpenAI configurada" }, { status: 402 });
    const openai = new OpenAI({ apiKey });

    // Llamar OpenAI con structured output
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: getSystemPrompt(tipoEspacio) },
        { role: "user", content: `El nombre del usuario es: ${aliasUsuario}
Tienes que saludarlo usando EXACTAMENTE ese nombre — no uses ningún otro.

Contexto del usuario hoy:
${ctxStr}

Devuélveme JSON con:
- saludo: saludo del día empezando con "¡Hola ${aliasUsuario}!" o similar (usando ese nombre tal cual)
- frase: frase motivacional o bíblica corta y relevante
- fortalezas: 1 frase corta sobre qué está haciendo bien (o "" si no hay datos)
- debilidades: 1 frase sobre qué falta (o "" si no hay datos)
- sugerencia: 1 acción concreta para hoy

Cada campo máximo 25 palabras. Sé específico con los números cuando aplique. Usa "${aliasUsuario}" en el saludo, no otros nombres.` },
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
export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });
    const url = new URL(req.url);
    let espacioId = url.searchParams.get("espacio_id");
    if (!espacioId) {
      espacioId = await getEspacioPersonal(supabase, user.id);
      if (!espacioId) return NextResponse.json({ error: "no espacio personal" }, { status: 404 });
    }
    await supabase.from("coach_consejos").delete().eq("espacio_id", espacioId).eq("perfil_id", user.id).eq("fecha", hoyIso());
    return GET(req);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "error" }, { status: 500 });
  }
}

async function getEspacioPersonal(sb: any, userId: string): Promise<string | null> {
  const { data } = await sb.from("espacios").select("id, tipo, espacio_miembros!inner(perfil_id)")
    .eq("tipo", "personal").eq("espacio_miembros.perfil_id", userId).maybeSingle();
  return data?.id ?? null;
}
