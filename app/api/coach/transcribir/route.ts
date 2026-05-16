import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { getOpenAIKeyParaEspacio } from "@/lib/openai-key";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Transcribe un audio (mp3/m4a/webm) usando OpenAI Whisper.
 * El cliente envía el archivo via FormData con campo "audio".
 * Devuelve { texto: "..." }.
 *
 * Costo aproximado: $0.006 / minuto. Un mensaje de 10 segundos ≈ $0.001.
 */
export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

    const formData = await req.formData();
    const audio = formData.get("audio");
    if (!audio || !(audio instanceof File)) {
      return NextResponse.json({ error: "audio no enviado" }, { status: 400 });
    }

    const espacioId = (formData.get("espacio_id") as string) || null;
    const apiKey = await getOpenAIKeyParaEspacio(espacioId);
    if (!apiKey) return NextResponse.json({ error: "Sin API key de OpenAI" }, { status: 402 });
    const openai = new OpenAI({ apiKey });

    // Whisper acepta múltiples formatos: mp3, mp4, mpeg, mpga, m4a, wav, webm
    const transcripcion = await openai.audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
      language: "es",
      // prompt opcional para guiar el contexto colombiano
      prompt: "Asistente coach en español colombiano. Términos comunes: lucas, parce, chévere, hábito, planeación, dropi, vasecom, tiktok, facebook, pauta.",
    });

    return NextResponse.json({ texto: transcripcion.text });
  } catch (e: any) {
    console.error("transcribir error:", e);
    return NextResponse.json({ error: e.message ?? "error transcribiendo" }, { status: 500 });
  }
}
