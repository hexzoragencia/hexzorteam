import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { hoyIso } from "@/lib/fechas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `Eres un asistente que convierte mensajes en lenguaje natural en acciones concretas en la app financiera/productividad de Victor.
Hablas español colombiano. Eres directo y conciso.

Acciones disponibles:
- crear_transaccion: cuando el usuario menciona un gasto o ingreso ("gasté 50k en pauta")
- marcar_habito: cuando dice que cumplió un hábito ("ya hice gym hoy", "leí 30 min")
- crear_tarea: cuando agenda algo ("reunión mañana 3pm")
- marcar_tarea_completada: cuando termina una tarea ya planeada ("ya hice X")
- marcar_subtarea: para sub-tareas de objetivos
- conversar: cuando solo charla, pregunta, o no hay acción clara

Reglas:
- Las fechas relativas (hoy, mañana, en 2 días) conviértelas a YYYY-MM-DD usando la fecha base que te paso.
- Los montos: "50k" = 50000, "1M" = 1000000, "200" = 200.
- Si no estás seguro, llama "conversar" pidiendo aclaración.
- Devuelve respuesta natural, breve (máx 2 frases), confirmando lo que hiciste o preguntando si dudas.`;

const tools: any[] = [
  {
    type: "function",
    function: {
      name: "crear_transaccion",
      description: "Registra un gasto o ingreso. Usa nombre_categoria si el usuario menciona claramente la categoría.",
      parameters: {
        type: "object",
        properties: {
          tipo_movimiento: { type: "string", enum: ["gasto", "ingreso"] },
          monto: { type: "number" },
          nombre_categoria: { type: "string", description: "Texto exacto que dijo el usuario para la categoría (PAUTA, GASOLINA, etc.)" },
          descripcion: { type: "string" },
          fecha: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["tipo_movimiento", "monto", "nombre_categoria", "fecha"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "marcar_habito",
      description: "Marca uno o varios hábitos como cumplidos en una fecha.",
      parameters: {
        type: "object",
        properties: {
          nombres: { type: "array", items: { type: "string" }, description: "Nombres aproximados de los hábitos" },
          fecha: { type: "string", description: "YYYY-MM-DD" },
        },
        required: ["nombres", "fecha"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crear_tarea",
      description: "Crea una tarea/reunión/bloqueo en planeación.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          fecha: { type: "string", description: "YYYY-MM-DD" },
          hora_inicio: { type: "string", description: "HH:MM (24h) o vacío si no tiene hora" },
          duracion_min: { type: "integer" },
          tipo: { type: "string", enum: ["tarea", "reunion", "bloqueo", "personal"] },
          descripcion: { type: "string" },
        },
        required: ["titulo", "fecha", "tipo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "marcar_tarea_completada",
      description: "Marca como completada una tarea ya existente que el usuario menciona.",
      parameters: {
        type: "object",
        properties: {
          texto_tarea: { type: "string", description: "Frase aproximada de la tarea" },
          fecha: { type: "string", description: "YYYY-MM-DD donde buscar (default hoy)" },
        },
        required: ["texto_tarea"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "conversar",
      description: "Cuando no hay acción concreta, solo conversa o pide aclaración.",
      parameters: {
        type: "object",
        properties: { respuesta: { type: "string" } },
        required: ["respuesta"],
      },
    },
  },
];

export async function POST(req: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "no auth" }, { status: 401 });

    const body = await req.json();
    const texto: string = String(body.texto ?? "").trim();
    if (!texto) return NextResponse.json({ error: "vacío" }, { status: 400 });

    const espacioId = await getEspacioPersonal(supabase, user.id);
    if (!espacioId) return NextResponse.json({ error: "no espacio personal" }, { status: 404 });

    const fechaHoy = hoyIso();

    // Llamar OpenAI con function calling
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Fecha de hoy: ${fechaHoy}.\n\nMensaje del usuario: "${texto}"` },
      ],
      tools,
      tool_choice: "required",
      temperature: 0.3,
    });

    const choice = completion.choices[0];
    const toolCalls = choice.message.tool_calls ?? [];
    const acciones: any[] = [];
    const resultados: string[] = [];

    for (const call of toolCalls) {
      // Type guard: solo procesamos function calls
      if (call.type !== "function") continue;
      const fn = call.function.name;
      let args: any = {};
      try { args = JSON.parse(call.function.arguments); } catch { /* ignore */ }
      acciones.push({ fn, args });

      try {
        const r = await ejecutarAccion(supabase, espacioId, fn, args, texto);
        if (r) resultados.push(r);
      } catch (e: any) {
        resultados.push(`⚠️ ${e.message ?? "error en " + fn}`);
      }
    }

    const respuesta = resultados.join(" · ") || "Listo.";

    // Log para debug
    await supabase.from("coach_comandos").insert({
      espacio_id: espacioId, perfil_id: user.id,
      texto_usuario: texto, acciones, respuesta,
    });

    return NextResponse.json({ respuesta, acciones });
  } catch (e: any) {
    console.error("comando error:", e);
    return NextResponse.json({ error: e.message ?? "error" }, { status: 500 });
  }
}

async function ejecutarAccion(sb: any, espacioId: string, fn: string, args: any, textoOriginal: string): Promise<string> {
  if (fn === "conversar") return args.respuesta || "Cuéntame más.";

  if (fn === "crear_transaccion") {
    // Buscar categoría más parecida (case-insensitive) entre las del espacio
    const { data: cats } = await sb.from("categorias").select("id, nombre, tipo").eq("espacio_id", espacioId);
    const nombreBuscado = String(args.nombre_categoria ?? "").toLowerCase();
    const cat = (cats ?? []).find((c: any) => c.nombre.toLowerCase() === nombreBuscado)
      ?? (cats ?? []).find((c: any) => c.nombre.toLowerCase().includes(nombreBuscado))
      ?? (cats ?? []).find((c: any) => nombreBuscado.includes(c.nombre.toLowerCase()));
    const monto = Number(args.monto);
    if (!monto || monto <= 0) throw new Error("Monto inválido");
    const { error } = await sb.from("transacciones").insert({
      espacio_id: espacioId,
      categoria_id: cat?.id ?? null,
      fecha: args.fecha,
      monto,
      descripcion: args.descripcion || args.nombre_categoria,
    });
    if (error) throw error;
    const tag = cat ? cat.nombre : `sin categoría (${args.nombre_categoria})`;
    return `✅ Registré $${monto.toLocaleString("es-CO")} en ${tag} el ${args.fecha}`;
  }

  if (fn === "marcar_habito") {
    const { data: habitos } = await sb.from("habitos").select("id, nombre").eq("espacio_id", espacioId).eq("archivado", false);
    const matched: string[] = [];
    const noMatched: string[] = [];
    for (const nombreBuscado of (args.nombres ?? [])) {
      const nb = String(nombreBuscado).toLowerCase();
      const h = (habitos ?? []).find((x: any) => x.nombre.toLowerCase().includes(nb) || nb.includes(x.nombre.toLowerCase()));
      if (!h) { noMatched.push(nombreBuscado); continue; }
      await sb.from("habito_marcas").upsert({ habito_id: h.id, fecha: args.fecha });
      matched.push(h.nombre);
    }
    const partes: string[] = [];
    if (matched.length) partes.push(`✅ Marqué: ${matched.join(", ")}`);
    if (noMatched.length) partes.push(`⚠️ No encontré: ${noMatched.join(", ")}`);
    return partes.join(" · ") || "Sin cambios.";
  }

  if (fn === "crear_tarea") {
    const { error } = await sb.from("tareas").insert({
      espacio_id: espacioId,
      titulo: args.titulo,
      fecha: args.fecha,
      hora_inicio: args.hora_inicio ? `${args.hora_inicio}:00` : null,
      duracion_min: args.duracion_min ?? 60,
      tipo: args.tipo ?? "tarea",
      descripcion: args.descripcion ?? null,
    });
    if (error) throw error;
    const horaTxt = args.hora_inicio ? ` a las ${args.hora_inicio}` : "";
    return `📅 Agendé "${args.titulo}" el ${args.fecha}${horaTxt}`;
  }

  if (fn === "marcar_tarea_completada") {
    const fecha = args.fecha ?? hoyIso();
    const { data: tareas } = await sb.from("tareas").select("id, titulo")
      .eq("espacio_id", espacioId).eq("fecha", fecha).eq("completada", false);
    const buscado = String(args.texto_tarea ?? "").toLowerCase();
    const t = (tareas ?? []).find((x: any) => x.titulo.toLowerCase().includes(buscado) || buscado.includes(x.titulo.toLowerCase()));
    if (!t) return `⚠️ No encontré una tarea pendiente que coincida con "${args.texto_tarea}"`;
    await sb.from("tareas").update({ completada: true, completada_at: new Date().toISOString() }).eq("id", t.id);
    return `✅ Marqué como hecha: "${t.titulo}"`;
  }

  return "";
}

async function getEspacioPersonal(sb: any, userId: string): Promise<string | null> {
  const { data } = await sb.from("espacios").select("id, tipo, espacio_miembros!inner(perfil_id)")
    .eq("tipo", "personal").eq("espacio_miembros.perfil_id", userId).maybeSingle();
  return data?.id ?? null;
}
