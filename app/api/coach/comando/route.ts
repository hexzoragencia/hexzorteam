import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { hoyIso } from "@/lib/fechas";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM = `Eres el coach personal del usuario en su app de finanzas + productividad. NO eres un asistente formal — eres como su MEJOR AMIGO que también es buen mentor: directo, cercano, colombiano, con humor sutil, sin ser empalagoso ni servicial. Le tratas de "tú" como un parcero.

# TONO
- Habla como hablaría un amigo bien parchado de Colombia, no un robot.
- Frases cortas. Naturales. Que se lean como una conversación real.
- Puedes usar coloquialismos colombianos: "parce", "todo bien", "listo", "hagale", "chévere" — pero sin exagerar.
- Cero "Como su asistente, le ayudo con..." Eso suena a robot.
- Cuando hace algo bien, festeja. Cuando se está desviando, dilo claro pero con cariño.
- Bromas suaves cuando aplique. Sin payasadas.

# CÓMO PIENSAS (RAZONA antes de actuar)
1. ¿Qué quiere realmente? Lee bien — entiende errores ortográficos, audios mal transcritos, jerga.
2. ¿Tengo TODA la info para ejecutar? Si falta, pregunta con "conversar".
3. ¿Hay AMBIGÜEDAD? (ej: "gasté en gym" — ¿cuánto?). Pregunta.
4. Si estás seguro, ejecuta la acción correcta.

# HERRAMIENTAS (escoge la mejor)
- crear_transaccion → registra gasto/ingreso. Ej: "gasté 50k en pauta", "me entró 1M de venta"
- marcar_habito → marca hábito como CUMPLIDO hoy/fecha. Ej: "ya hice gym", "leí 30 min"
- crear_habito → AGREGA un hábito nuevo a la rutina. Ej: "agrégame el hábito de meditar a las 7am"
- crear_tarea → agenda algo en la planeación diaria. Ej: "reunión con Miguel mañana 3pm"
- marcar_tarea_completada → marca como hecha una tarea YA agendada. Ej: "ya hice la reunión"
- conversar → responde en lenguaje natural; cuando charla, falta info, o quieres preguntar

# REGLAS IMPORTANTES
1. **Fechas relativas**: convierte a YYYY-MM-DD usando la fecha que te paso como referencia. "Mañana" = hoy + 1 día.
2. **Montos colombianos**: "50k" = 50000, "1M" = 1000000, "100 lucas" = 100000, "1 millón quinientos" = 1500000.
3. **crear_tarea**:
   - SIEMPRE pon duracion_min (default 60 si no es claro).
   - Si menciona hora ("3pm", "por la tarde a las 4"), pónla en hora_inicio.
   - Si NO menciona hora, deja hora_inicio vacío — el backend le pone el próximo slot libre.
4. **crear_habito**:
   - REQUIERE horario explícito ("a las 7am", "de 6 a 7"). Si NO lo dijo, llama "conversar" preguntando: "Listo. ¿De qué hora a qué hora quieres hacer este hábito? Así te lo agendo automáticamente en tu Planeación diaria." NO crees el hábito sin hora.
5. **Múltiples acciones en un mensaje**: si dice "agéndame X y Y y Z", llama crear_tarea 3 veces (una por cada).
6. **Si dudas, pregunta**: usa "conversar" en vez de adivinar mal.
7. **Tono final**: como un amigo que está al otro lado. Máximo 2 frases. Natural, no robot.

# EJEMPLOS DE RAZONAMIENTO

Usuario: "agéndame una reunión"
Razonamiento: Falta CON QUIÉN, CUÁNDO. → conversar: "¿Con quién y a qué hora? Si me das eso te la agendo."

Usuario: "agrégame el hábito de gym"
Razonamiento: NO dijo a qué hora. → conversar: "Listo. ¿De qué hora a qué hora quieres hacer gym? Así te lo agendo en tu Planeación diaria."

Usuario: "gasté como 50 luchas en mercado"
Razonamiento: Gasto de 50000 (luchas = miles colombiano). Categoría aproximada: alimentación/mercado. Fecha: hoy. → crear_transaccion(monto: 50000, nombre_categoria: "mercado", fecha: hoy)

Usuario: "ya hice ejercicio y leí, marca eso"
Razonamiento: Dos hábitos cumplidos hoy. → marcar_habito(nombres: ["ejercicio", "leer"], fecha: hoy)

Usuario: "estoy estresado"
Razonamiento: No es acción concreta, es charla. → conversar: respuesta empática + pregunta para entender mejor.

Usuario: "agéndame entrenar de 6 a 7am todos los días"
Razonamiento: Hábito con horario claro. → crear_habito(nombre: "Entrenar", hora_desde: "06:00", hora_hasta: "07:00")
`;

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
      name: "crear_habito",
      description: "Crea un nuevo hábito y AUTO-AGENDA en planeación diaria. SOLO usar cuando el usuario YA ESPECIFICÓ horario claro (ej 'a las 7am', 'de 6 a 7'). Si no hay horario, usa 'conversar' para preguntar antes de crear.",
      parameters: {
        type: "object",
        properties: {
          nombre: { type: "string", description: "Nombre del hábito (ej: 'Ejercicio', 'Leer 30 min')" },
          hora_desde: { type: "string", description: "HH:MM (24h) cuando empieza el hábito. REQUERIDA antes de crear." },
          hora_hasta: { type: "string", description: "HH:MM (24h) cuando termina, opcional. Si solo se especifica hora_desde, dura 30 min por default." },
        },
        required: ["nombre", "hora_desde"],
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

    let espacioId: string | null = body.espacio_id ?? null;
    if (espacioId) {
      // Verificar que el usuario es miembro
      const { data: esp } = await supabase.from("espacios").select("id, espacio_miembros!inner(perfil_id)")
        .eq("id", espacioId).eq("espacio_miembros.perfil_id", user.id).maybeSingle();
      if (!esp) return NextResponse.json({ error: "espacio no accesible" }, { status: 403 });
    } else {
      espacioId = await getEspacioPersonal(supabase, user.id);
      if (!espacioId) return NextResponse.json({ error: "no espacio personal" }, { status: 404 });
    }

    const fechaHoy = hoyIso();

    // Obtener alias del usuario en este espacio para personalizar saludos
    const [{ data: miembro }, { data: perfil }] = await Promise.all([
      supabase.from("espacio_miembros").select("alias").eq("espacio_id", espacioId).eq("perfil_id", user.id).maybeSingle(),
      supabase.from("perfiles").select("nombre").eq("id", user.id).maybeSingle(),
    ]);
    const aliasUser = ((miembro as any)?.alias || perfil?.nombre || "amigo").trim();
    const ahora = new Date();
    const horaActual = ahora.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Bogota" });

    // Construir historial de chat (últimas N mensajes del cliente, opcional)
    type ChatMsg = { rol: "usuario" | "coach"; texto: string };
    const historial: ChatMsg[] = Array.isArray(body.historial) ? body.historial.slice(-8) : [];
    const historialMessages = historial
      .filter(m => m.texto && (m.rol === "usuario" || m.rol === "coach"))
      .map(m => ({
        role: m.rol === "usuario" ? "user" as const : "assistant" as const,
        content: m.texto,
      }));

    // Llamar OpenAI con function calling
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "system",
          content: `CONTEXTO ACTUAL:
- Usuario: ${aliasUser}
- Fecha de hoy: ${fechaHoy} (${ahora.toLocaleDateString("es-CO", { weekday: "long", timeZone: "America/Bogota" })})
- Hora local: ${horaActual} (zona horaria America/Bogota)
- Espacio actual: ${espacioId}`
        },
        ...historialMessages,
        { role: "user", content: texto },
      ],
      tools,
      tool_choice: "required",
      temperature: 0.4,
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

  if (fn === "crear_habito") {
    const nombre = String(args.nombre ?? "").trim();
    if (!nombre) throw new Error("Falta el nombre del hábito");
    const horaDesde = args.hora_desde ? `${args.hora_desde}:00` : null;
    const horaHasta = args.hora_hasta ? `${args.hora_hasta}:00` : null;

    // Insertar el hábito
    const { data: nuevoHabito, error: errH } = await sb.from("habitos").insert({
      espacio_id: espacioId, nombre,
      hora_desde: horaDesde, hora_hasta: horaHasta,
      orden: 0,
    }).select().single();
    if (errH) throw errH;

    // Si tiene hora, auto-generar tareas en planeación para los próximos 30 días
    let tareasCreadas = 0;
    if (horaDesde && nuevoHabito) {
      const tareas: any[] = [];
      const hoy = new Date(hoyIso() + "T00:00:00");
      for (let i = 0; i < 30; i++) {
        const d = new Date(hoy);
        d.setDate(d.getDate() + i);
        const fecha = d.toISOString().slice(0, 10);
        const duracionMin = horaHasta ? Math.max(15, Math.round(
          (parseInt(horaHasta.slice(0,2)) * 60 + parseInt(horaHasta.slice(3,5))) -
          (parseInt(horaDesde.slice(0,2)) * 60 + parseInt(horaDesde.slice(3,5)))
        )) : 30;
        tareas.push({
          espacio_id: espacioId,
          titulo: nombre,
          fecha,
          hora_inicio: horaDesde,
          duracion_min: duracionMin,
          tipo: "personal",
          habito_id: nuevoHabito.id,
        });
      }
      const { error: errT } = await sb.from("tareas").insert(tareas);
      if (!errT) tareasCreadas = tareas.length;
    }

    const horaTxt = horaDesde ? ` a las ${horaDesde.slice(0,5)}` : "";
    const tareasTxt = tareasCreadas > 0 ? ` y lo agendé en planeación por los próximos ${tareasCreadas} días` : "";
    return `✨ Creé el hábito "${nombre}"${horaTxt}${tareasTxt}.`;
  }

  if (fn === "crear_tarea") {
    const duracion = args.duracion_min ?? 60;
    let hora: string | null = null;
    if (args.hora_inicio) {
      // El usuario o la IA dio una hora explícita
      hora = `${args.hora_inicio}:00`;
    } else {
      // Auto-asignar siguiente slot libre en horario laboral
      const slot = await siguienteSlotLibre(sb, espacioId, args.fecha, duracion);
      hora = slot;
    }

    const { error } = await sb.from("tareas").insert({
      espacio_id: espacioId,
      titulo: args.titulo,
      fecha: args.fecha,
      hora_inicio: hora,
      duracion_min: duracion,
      tipo: args.tipo ?? "tarea",
      descripcion: args.descripcion ?? null,
    });
    if (error) throw error;
    const horaCorta = hora ? hora.slice(0, 5) : null;
    const horaTxt = horaCorta ? ` a las ${horaCorta}` : "";
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

/**
 * Busca el siguiente slot libre en horario laboral (8am-8pm) para una fecha dada.
 * Considera tareas existentes y va encontrando el primer hueco que entre la duración pedida.
 * Snap a la hora en punto (08:00, 09:00, ...) para que se vea ordenado.
 * Si no encuentra slot, devuelve null (la tarea queda sin hora — visible arriba del día).
 */
async function siguienteSlotLibre(
  sb: any, espacioId: string, fecha: string, duracionMin: number,
): Promise<string | null> {
  const HORA_INICIO_DIA = 8 * 60;   // 08:00
  const HORA_FIN_DIA = 20 * 60;     // 20:00
  const SNAP_MIN = 60;              // snap a horas en punto

  const { data: existentes } = await sb.from("tareas")
    .select("hora_inicio, duracion_min")
    .eq("espacio_id", espacioId)
    .eq("fecha", fecha)
    .not("hora_inicio", "is", null)
    .order("hora_inicio", { ascending: true });

  // Convertir tareas existentes a [start, end] en minutos
  const ocupados: { start: number; end: number }[] = (existentes ?? [])
    .map((t: any) => {
      const [h, m] = String(t.hora_inicio).split(":").map(Number);
      const start = h * 60 + m;
      const end = start + (t.duracion_min || 60);
      return { start, end };
    })
    .sort((a: any, b: any) => a.start - b.start);

  // Cursor empieza en horario laboral, snapeado a hora en punto
  let cursor = HORA_INICIO_DIA;

  for (const o of ocupados) {
    // ¿Hay hueco antes de esta tarea?
    if (o.start - cursor >= duracionMin) {
      // Snap cursor a próxima hora en punto
      const cursorSnap = Math.ceil(cursor / SNAP_MIN) * SNAP_MIN;
      if (o.start - cursorSnap >= duracionMin) return formatHora(cursorSnap);
      // Si snap empuja muy cerca, intentamos el cursor sin snap
      if (o.start - cursor >= duracionMin) return formatHora(cursor);
    }
    cursor = Math.max(cursor, o.end);
  }

  // Después de todas las tareas, ¿queda espacio antes del cierre?
  const cursorSnap = Math.ceil(cursor / SNAP_MIN) * SNAP_MIN;
  if (HORA_FIN_DIA - cursorSnap >= duracionMin) return formatHora(cursorSnap);

  return null;
}

function formatHora(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}
