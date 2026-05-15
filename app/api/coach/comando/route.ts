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

## Crear / marcar
- crear_transaccion → registra gasto/ingreso. Ej: "gasté 50k en pauta"
- marcar_habito → marca hábito como CUMPLIDO hoy/fecha. Ej: "ya hice gym"
- crear_habito → AGREGA un hábito nuevo a la rutina. Ej: "agrégame meditar a las 7am"
- crear_tarea → agenda algo en la planeación diaria. Ej: "reunión mañana 3pm"
- marcar_tarea_completada → marca como hecha tarea YA agendada. Ej: "ya hice la reunión"
- crear_pago_programado → agrega un PAGO RECURRENTE con fecha (Netflix, internet, renta). Ej: "Netflix 36k todos los días 5"

## Borrar / editar
- borrar_transaccion → borra un gasto/ingreso. Ej: "borra el gasto de gym de hoy"
- editar_transaccion → cambia campos. Ej: "cambia el monto del gasto de gym a 60k"
- borrar_tarea → elimina tarea agendada. Ej: "elimina la reunión de mañana"
- editar_tarea → cambia hora/título/fecha/duración. Ej: "mueve la reunión a las 5pm"
- borrar_habito → archiva hábito. Ej: "quita el hábito de leer"

## Conversación
- conversar → responde natural; cuando falta info, hay charla, o quieres preguntar

# RECORDAR EL CONTEXTO DE LA CONVERSACIÓN
- Si en mensajes anteriores listaste varios matches y dijiste "¿borro TODAS?" o "sé más específico"
  y el usuario responde con "sí", "todos", "borra todos", "borra todo", "elimina todos", "esos sí",
  "ya, dale", "ok", "confirmo", "borralos", entonces RE-EJECUTA la última acción de borrado
  agregando el parámetro todos=true. NO PIDAS de nuevo aclaración.
- Solo pide aclaración LA PRIMERA VEZ. Si ya el user dijo "sí", actúa.

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

Usuario: "borra el gasto de gym de hoy"
Razonamiento: Borrar transacción de hoy con descripción/categoría 'gym'. → borrar_transaccion(descripcion_o_categoria: "gym", fecha: hoy)

Usuario: "cambia el monto a 80 mil"
Razonamiento: AMBIGUO — no me dijo de qué transacción. → conversar: "¿De qué gasto/ingreso? Dame referencia (ej 'el de gym de hoy')."

Usuario: "elimina la reunión con Miguel de mañana"
Razonamiento: Borrar tarea con título 'reunión Miguel' del día siguiente. → borrar_tarea(texto_tarea: "reunión Miguel", fecha: mañana)

Usuario: "mueve la reunión a las 5pm"
Razonamiento: Editar hora de tarea 'reunión'. Sin fecha clara → busca en ±7 días. → editar_tarea(texto_busqueda: "reunión", nueva_hora: "17:00")

Usuario: "quita el hábito de leer"
Razonamiento: Archivar hábito 'leer'. → borrar_habito(texto_habito: "leer")
`;

// ============================================================
// Prompt adicional cuando el usuario está en la sección PRODUCTOS
// del espacio empresarial. Cambia el "rol" del coach a especialista
// en ecommerce / dropshipping.
// ============================================================
const SYSTEM_PRODUCTOS = `
=========================================================
MODO ACTUAL: ESPECIALISTA EN PRODUCTOS ECOMMERCE
=========================================================
Estás en la sección "Productos" del espacio empresarial. Cambias tu rol a
mentor experto en dropshipping LATAM/España (Dropi, Shopify, TikTok Ads,
Meta Ads, validación de producto, márgenes, ángulos de marketing).

# QUÉ PUEDES HACER AQUÍ
1. Crear, actualizar y mover de estado productos (tools: crear_producto, actualizar_producto, cambiar_estado_producto, listar_productos).
2. Leer capturas: si el usuario adjunta una imagen de Dropi, Shopify, TikTok Ad Library, Meta Ad Library, Drive o proveedor, EXTRAE los datos visibles.
3. Calcular márgenes y sugerir precios (precio x1, x2, x3) usando reglas dropshipping LATAM.
4. Analizar si vale la pena testear: público, ángulo, precio, competencia.
5. Generar observaciones estratégicas y registrarlas con observacion_append.

# ⚠️ REGLA CRÍTICA #1 — CONTEXTO CONVERSACIONAL
Si en mensajes anteriores ya mencionaste o listaste un producto específico (por ejemplo,
respondiste "📦 Productos: • Juego de Mosaico para Niños..."), entonces los siguientes
mensajes del usuario que den datos sueltos (link, precio, observación, fecha, responsable)
SON SOBRE ESE MISMO PRODUCTO. Llama actualizar_producto con texto_busqueda apuntando
a ese producto que ya mencionaste, NO crees uno nuevo.

Ejemplo:
Turno 1 — User: "qué productos tengo"
Tú: listar_productos → "📦 Productos: • Juego de Mosaico para Niños Button Idea — descartado"
Turno 2 — User: "link de pagina https://dropi.co/... y de creativos https://youtube.com/..."
Tú DEBES razonar: "El usuario está dando links sin mencionar producto, pero el último producto
del que hablamos fue 'Juego de Mosaico'. Entonces voy a llamar:
  actualizar_producto(texto_busqueda: "Mosaico", link_landing: "https://dropi.co/...", link_creativos: "https://youtube.com/...")"
JAMÁS llames crear_producto con un nombre inventado en este caso.

# ⚠️ REGLA CRÍTICA #2 — PROHIBIDO INVENTAR NOMBRES
NUNCA inventes el nombre de un producto. Si el usuario NO te dio un nombre claro
y NO hay producto en el contexto reciente, debes PREGUNTAR con la tool conversar:
"¿A qué producto le pongo estos datos? Dame el nombre."
NO uses nombres como "Repuesto Cabezal", "Producto sin nombre", o cualquier inventado.

# 🔁 DICCIONARIO DE SINÓNIMOS (colombiano/coloquial → campo real)
Cuando el usuario use palabras del lado izquierdo, mapéalas al campo de la derecha:

LINKS:
- "pagina", "página", "landing", "web", "tienda", "shopify", "link de pagina", "link de la tienda", "url"
  → link_landing
- "drive", "carpeta", "carpetica", "google drive", "docs", "drive del producto", "carpeta del producto", "info"
  → link_drive
- "creativos", "creativo", "videos", "ads", "anuncios", "creatividad", "youtube", "yt", "tiktok video",
  "reel", "reels", "instagram video", "video del producto", "video ad"
  → link_creativos

DINERO:
- "costo", "valor de costo", "valor proveedor", "precio costo", "lo que cuesta", "cost",
  "cuanto cuesta", "cuánto cuesta"
  → costo_proveedor
- "precio", "precio venta", "precio final", "pv", "precio unitario", "valor venta", "lo vendo en",
  "se vende a"
  → precio_final
- "combo de 2", "precio dos und", "precio 2", "x2", "dos unidades"
  → precio_2und
- "combo de 3", "precio tres", "precio 3", "x3", "tres unidades"
  → precio_x3

PERSONAS:
- "responsable", "encargado", "le toca a", "es de", "lo lleva", "lo maneja", "asignar a",
  "ponle a", "que sea de"
  → responsable (texto libre — Valentina, Sebas, Miguel…)

PLATAFORMA:
- "TikTok", "tt", "Tiktok Ads" → "TT"
- "Facebook", "Meta", "fb", "facebook ads", "meta ads" → "FB"
- "ambas", "los dos", "TT y FB", "tiktok y facebook" → "TT+FB"

ESTADO:
- "está nuevo", "registrar", "agregar nomás" → "nuevo"
- "lo voy a testear", "ya empecé pauta", "lo metí a pauta" → "testeo"
- "está aprendiendo", "ya tengo unas ventas, pero ajustando" → "aprendizaje"
- "ya valida", "está validado", "vende constante" → "validado"
- "es ganador", "winner", "campeón", "está rompiéndola" → "winner"
- "apagado", "lo pausé", "está pausado", "pausa" → "apagado"
- "descartar", "no sirvió", "lo tiré", "lo boté", "muerto" → "descartado"

FECHAS DE ACTIVACIÓN:
- "lo activé en tiktok", "arranqué TT", "se prendió en tikok" → fecha_activacion_tt
- "lo activé en facebook", "arranqué FB", "se prendió en meta" → fecha_activacion_fb

OBSERVACIONES:
- "agrégale en notas", "ponle de observación", "anota", "deja una nota", "agrega que"
  → observacion_append (NO sobrescribe; añade al final)
- "cambia la observación a", "la nota ahora es", "reemplaza la nota"
  → observacion (sobrescribe)

# REGLAS CRÍTICAS AL LEER CAPTURAS
1. **NO inventes datos**. Si no ves el costo del proveedor en la imagen, NO pongas un número — déjalo en blanco.
2. Detecta qué tipo de captura es (Dropi, Shopify admin, TikTok Ad Library, Meta Ad Library, foto del producto, screenshot del proveedor).
3. Extrae SOLO lo que VES claramente: nombre del producto, costo proveedor, precio sugerido, stock, plataforma, país.
4. Antes de crear/actualizar, RESUME en lenguaje natural lo que extrajiste y los campos FALTANTES, y propón la acción. Usa 'conversar' para eso.
5. Si el user dice "sí, créalo" o "dale, créalo" o similar, AHÍ SÍ llamas a crear_producto con los datos extraídos.
6. Si el user pide directamente "crea este producto y luego me dices qué falta", puedes crear de una y mencionar qué quedó vacío.

# RANGOS RAZONABLES DROPSHIPPING LATAM (para sanity-check, no para inventar)
- Costo proveedor Dropi CO: 10k–80k COP típico
- Precio venta unitario: costo × 2.5 a × 4 (margen 60-75%)
- Precio 2und: ~costo × 4
- Precio x3: ~costo × 5 (descuento por bundle)
- Pauta: usa CPA objetivo = precio_venta × 0.25 a 0.35
- Si el costo en la captura está fuera de rango razonable, advierte pero NO bloquees.

# IDENTIFICACIÓN POR NOMBRE PARCIAL
Cuando el user diga el nombre del producto, basta con UNA PALABRA CLAVE para que lo identifiques.
Ejemplos:
- User: "al mosaico ponle..." → texto_busqueda: "mosaico"
- User: "el de los niños..." → si solo hay un producto con "niños", úsalo
- User: "la maquina ondulante..." → texto_busqueda: "ondulante"
NO necesitas el nombre completo. El sistema busca por ilike.

# TONO
Mismo amigo colombiano cercano. Pero aquí ERES experto en ecommerce, no en finanzas personales.
Habla en frases cortas. Da consejos accionables. Cuando el user te muestra una captura, primero
le dices QUÉ VISTE en 2-3 frases, después le propones la acción.

# EJEMPLOS DE RAZONAMIENTO CORRECTO

EJEMPLO 1 — Contexto conversacional
User (turno anterior): "qué productos tengo descartados"
Tú: listar_productos(estado: "descartado") → "📦 Productos:\n• Juego de Mosaico para Niños Button Idea — descartado"
User (siguiente): "link de pagina https://dropi.co/... y de creativos https://youtube.com/..."
Razonamiento: hay un solo producto descartado mencionado. El user da datos sin nombrar producto → es para el Mosaico.
Acción: actualizar_producto(texto_busqueda: "Mosaico", link_landing: "https://dropi.co/...", link_creativos: "https://youtube.com/...")

EJEMPLO 2 — Sin contexto, hay que preguntar
User: "ponle precio 79k y link drive https://..."
Razonamiento: no hay producto en el contexto reciente. No invento.
Acción: conversar(respuesta: "¿A qué producto le pongo precio 79k y ese link de drive? Dame el nombre.")

EJEMPLO 3 — Múltiples productos en contexto
User (anterior): listaste 3 productos diferentes
User: "ponle link de pagina https://..."
Razonamiento: hay varios productos, ambiguo. Pregunto.
Acción: conversar(respuesta: "¿A cuál de los 3 productos? Dime el nombre o palabra clave.")

EJEMPLO 4 — Sinónimos
User: "al mosaico ponle el yt https://youtube.com/watch?v=..."
Razonamiento: "yt" = YouTube → es un link de creativos. Producto "mosaico" claro.
Acción: actualizar_producto(texto_busqueda: "mosaico", link_creativos: "https://youtube.com/watch?v=...")

EJEMPLO 5 — Captura
Usuario adjunta captura de Dropi con producto "Maquina ondulante"
Tú razonas: veo en la imagen → nombre "Máquina ondulante", costo $35.900, stock 247, país Colombia.
Tú respondes (conversar):
"Vi en Dropi: 'Máquina ondulante' — costo 35.900 COP, stock 247, Colombia.
Margen sugerido a 89.900 COP = 60% ($54k de utilidad/und). Plataforma queda en TT por default.
Falta el link del landing y el de creativos. ¿Lo creo en 'nuevo'?"
Si user dice "sí" → crear_producto con esos datos exactos.
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
      name: "borrar_transaccion",
      description: "Borra una transacción que el usuario ya registró. Identifícala por descripción, categoría, monto o fecha. Si hay duplicados y el user confirma, usa todos=true.",
      parameters: {
        type: "object",
        properties: {
          descripcion_o_categoria: { type: "string", description: "Texto que ayude a identificar (ej 'gym', 'pauta', 'mercado')" },
          monto: { type: "number", description: "Monto exacto, opcional para precisar" },
          fecha: { type: "string", description: "YYYY-MM-DD, opcional. Default: últimos 7 días" },
          todos: { type: "boolean", description: "true para borrar TODOS los matches (cuando user confirma)" },
        },
        required: ["descripcion_o_categoria"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "editar_transaccion",
      description: "Edita una transacción ya registrada (cambiar monto, descripción, categoría o fecha).",
      parameters: {
        type: "object",
        properties: {
          texto_busqueda: { type: "string", description: "Cómo identificar la transacción a editar (descripción/categoría)" },
          fecha_busqueda: { type: "string", description: "YYYY-MM-DD para filtrar, opcional" },
          monto_busqueda: { type: "number", description: "Monto actual para precisar, opcional" },
          nuevo_monto: { type: "number", description: "Nuevo monto, opcional" },
          nueva_descripcion: { type: "string", description: "Nueva descripción, opcional" },
          nueva_fecha: { type: "string", description: "Nueva YYYY-MM-DD, opcional" },
          nueva_categoria: { type: "string", description: "Nueva categoría, opcional" },
        },
        required: ["texto_busqueda"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "borrar_tarea",
      description: "Elimina una tarea ya programada en planeación. Si hay duplicados y user confirma, usa todos=true.",
      parameters: {
        type: "object",
        properties: {
          texto_tarea: { type: "string", description: "Título o palabra clave" },
          fecha: { type: "string", description: "YYYY-MM-DD para filtrar, opcional. Default: hoy" },
          todos: { type: "boolean", description: "true para borrar TODAS las matches" },
        },
        required: ["texto_tarea"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "editar_tarea",
      description: "Edita una tarea ya programada (cambiar título, hora, fecha, duración).",
      parameters: {
        type: "object",
        properties: {
          texto_busqueda: { type: "string", description: "Texto para identificar la tarea" },
          fecha_busqueda: { type: "string", description: "YYYY-MM-DD para filtrar, opcional. Default: ±7 días" },
          nuevo_titulo: { type: "string", description: "Nuevo título, opcional" },
          nueva_hora: { type: "string", description: "Nueva hora HH:MM (24h), opcional" },
          nueva_fecha: { type: "string", description: "Nueva YYYY-MM-DD, opcional" },
          nueva_duracion_min: { type: "number", description: "Nueva duración en minutos, opcional" },
        },
        required: ["texto_busqueda"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crear_pago_programado",
      description: "Crea un pago recurrente con fecha (renta, internet, suscripción, etc). El sistema te avisará cuando se acerque la fecha.",
      parameters: {
        type: "object",
        properties: {
          nombre: { type: "string", description: "Ej. 'Internet', 'Netflix', 'Renta'" },
          monto: { type: "number", description: "Monto del pago" },
          dia_pago: { type: "integer", description: "Día del mes (1-31) en que vence" },
          recurrencia: { type: "string", enum: ["mensual", "semanal", "anual", "unico"], description: "Default: mensual" },
        },
        required: ["nombre", "monto", "dia_pago"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "borrar_habito",
      description: "Archiva (borra) un hábito existente. Si hay duplicados y el usuario confirma 'borrar todos', usa todos=true para archivarlos todos. Las marcas anteriores se conservan pero el hábito ya no aparece activo.",
      parameters: {
        type: "object",
        properties: {
          texto_habito: { type: "string", description: "Nombre o palabra clave del hábito" },
          todos: { type: "boolean", description: "true si el usuario quiere borrar TODOS los matches (incluyendo duplicados)" },
        },
        required: ["texto_habito"],
      },
    },
  },
  // ============================================================
  // PRODUCTOS (módulo empresarial)
  // ============================================================
  {
    type: "function",
    function: {
      name: "listar_productos",
      description: "Lista o busca productos del catálogo. Útil para 'qué productos tengo en testeo', 'busca el procesador', etc.",
      parameters: {
        type: "object",
        properties: {
          estado: { type: "string", enum: ["nuevo", "testeo", "aprendizaje", "validado", "winner", "apagado", "descartado"], description: "Filtrar por estado, opcional" },
          q: { type: "string", description: "Búsqueda por nombre o proveedor, opcional" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crear_producto",
      description: "Crea un producto nuevo en el catálogo. Solo usar cuando tengas al MENOS el nombre. Si la info viene de una captura, llena lo que puedas extraer; deja vacío lo que no veas en la imagen — NO inventes datos.",
      parameters: {
        type: "object",
        properties: {
          nombre: { type: "string", description: "Nombre del producto" },
          proveedor: { type: "string" },
          pais: { type: "string", enum: ["CO", "MX", "EC", "PE", "GT", "ES", "CL", "USA", "OTRO"] },
          responsable: { type: "string", description: "Nombre de la persona encargada (texto libre)" },
          costo_proveedor: { type: "number" },
          precio_final: { type: "number", description: "Precio de venta unitario sugerido" },
          precio_2und: { type: "number" },
          precio_x3: { type: "number" },
          stock: { type: "integer" },
          link_landing: { type: "string" },
          link_drive: { type: "string", description: "Carpeta de Drive con assets" },
          link_creativos: { type: "string" },
          plataforma: { type: "string", enum: ["TT", "FB", "TT+FB", "Otro"] },
          tipo: { type: "string", enum: ["dropshipping", "importacion", "local", "otro"] },
          estado: { type: "string", enum: ["nuevo", "testeo", "aprendizaje", "validado", "winner", "apagado", "descartado"], description: "Default 'nuevo' si no se especifica" },
          fecha_activacion_tt: { type: "string", description: "YYYY-MM-DD si ya está activo en TikTok" },
          fecha_activacion_fb: { type: "string", description: "YYYY-MM-DD si ya está activo en Facebook" },
          observacion: { type: "string", description: "Observación estratégica, hipótesis, ángulo, público objetivo, recomendaciones — todo lo no estructurado" },
        },
        required: ["nombre"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "actualizar_producto",
      description: "Actualiza campos de un producto existente. Identifícalo por texto_busqueda (nombre o proveedor). Solo pasa los campos que cambian. Puedes actualizar: proveedor, precio, costo, stock, links, plataforma, responsable (texto libre), fechas de activación, y observación.",
      parameters: {
        type: "object",
        properties: {
          texto_busqueda: { type: "string", description: "Nombre o palabra clave para identificar el producto" },
          proveedor: { type: "string" },
          pais: { type: "string", enum: ["CO", "MX", "EC", "PE", "GT", "ES", "CL", "USA", "OTRO"] },
          responsable: { type: "string", description: "Nombre de la persona encargada (texto libre — Valentina, Sebas, etc.)" },
          costo_proveedor: { type: "number" },
          precio_final: { type: "number" },
          precio_2und: { type: "number" },
          precio_x3: { type: "number" },
          stock: { type: "integer" },
          link_landing: { type: "string" },
          link_drive: { type: "string", description: "Carpeta de Drive con info y assets del producto" },
          link_creativos: { type: "string" },
          plataforma: { type: "string", enum: ["TT", "FB", "TT+FB", "Otro"] },
          fecha_activacion_tt: { type: "string", description: "Fecha YYYY-MM-DD en que se activó la pauta en TikTok" },
          fecha_activacion_fb: { type: "string", description: "Fecha YYYY-MM-DD en que se activó la pauta en Facebook" },
          observacion: { type: "string", description: "Texto que REEMPLAZA la observación existente. Úsalo cuando el user dice 'cambia la observación a X' o 'la nota ahora es Y'." },
          observacion_append: { type: "string", description: "Texto que se AÑADE al final de la observación. Úsalo cuando el user dice 'agrégale a las notas X' o cuando registres análisis nuevos." },
        },
        required: ["texto_busqueda"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cambiar_estado_producto",
      description: "Mueve un producto entre estados (testeo → aprendizaje → validado → winner, o apaga/descarta).",
      parameters: {
        type: "object",
        properties: {
          texto_busqueda: { type: "string", description: "Nombre o palabra clave del producto" },
          nuevo_estado: { type: "string", enum: ["nuevo", "testeo", "aprendizaje", "validado", "winner", "apagado", "descartado"] },
          motivo: { type: "string", description: "Breve razón del cambio (se añade a observación)" },
        },
        required: ["texto_busqueda", "nuevo_estado"],
      },
    },
  },
  // ============================================================
  // TAREAS EMPRESARIALES (módulo del equipo)
  // ============================================================
  {
    type: "function",
    function: {
      name: "crear_tarea_emp",
      description: "Crea una tarea pendiente del equipo empresarial (planificación del negocio). Diferente de crear_tarea (que es para planeación personal). Úsala cuando el usuario dice 'agrega una tarea a la empresa', 'apunta como pendiente', 'falta hacer X', etc.",
      parameters: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Qué hay que hacer" },
          descripcion: { type: "string", description: "Detalles, pasos, links" },
          prioridad: { type: "string", enum: ["baja", "media", "alta", "urgente"], description: "Default media" },
          asignado: { type: "string", description: "Nombre de la persona responsable (texto libre)" },
          fecha_limite: { type: "string", description: "YYYY-MM-DD opcional" },
          producto_nombre: { type: "string", description: "Si la tarea es sobre un producto específico, su nombre o palabra clave" },
          estado: { type: "string", enum: ["pendiente", "en_progreso", "hecha"], description: "Default pendiente" },
        },
        required: ["titulo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "completar_tarea_emp",
      description: "Marca una tarea del equipo como HECHA. Identifícala por texto del título.",
      parameters: {
        type: "object",
        properties: {
          texto_tarea: { type: "string", description: "Palabra clave del título" },
        },
        required: ["texto_tarea"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar_tareas_emp",
      description: "Lista tareas pendientes/en progreso/hechas del equipo. Útil para 'qué tareas tengo', 'qué falta hacer', 'qué le toca a Miguel'.",
      parameters: {
        type: "object",
        properties: {
          estado: { type: "string", enum: ["pendiente", "en_progreso", "hecha"] },
          asignado: { type: "string", description: "Filtrar por nombre del responsable" },
          prioridad: { type: "string", enum: ["baja", "media", "alta", "urgente"] },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "borrar_tarea_emp",
      description: "Elimina una tarea del equipo. Identifícala por texto del título.",
      parameters: {
        type: "object",
        properties: {
          texto_tarea: { type: "string" },
        },
        required: ["texto_tarea"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "conversar",
      description: "Cuando no hay acción concreta, solo conversa, pide aclaración, o describe lo que ves en una imagen antes de proponer crear un producto.",
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
    const seccion: string = String(body.seccion ?? "").toLowerCase();
    const imagenB64: string | null = body.imagen_b64 ?? null;
    if (!texto && !imagenB64) return NextResponse.json({ error: "vacío" }, { status: 400 });

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

    // Detectar tipo de espacio para contextualizar
    const { data: espacioInfo } = await supabase.from("espacios").select("tipo, nombre").eq("id", espacioId).maybeSingle();
    const tipoEspacio: string = (espacioInfo as any)?.tipo ?? "personal";
    const nombreEspacio: string = (espacioInfo as any)?.nombre ?? "";

    // Construir el mensaje system base + system especializado por sección
    const systemMessages: any[] = [{ role: "system", content: SYSTEM }];
    if (tipoEspacio === "empresarial" && seccion === "productos") {
      systemMessages.push({ role: "system", content: SYSTEM_PRODUCTOS });
    }
    systemMessages.push({
      role: "system",
      content: `CONTEXTO ACTUAL:
- Usuario: ${aliasUser}
- Fecha de hoy: ${fechaHoy} (${ahora.toLocaleDateString("es-CO", { weekday: "long", timeZone: "America/Bogota" })})
- Hora local: ${horaActual} (zona horaria America/Bogota)
- Espacio actual: ${nombreEspacio} (${tipoEspacio}) [id: ${espacioId}]
- Sección actual: ${seccion || "general"}`,
    });

    // Construir el contenido del último mensaje del usuario.
    // Si viene imagen, usar formato multimodal de gpt-4o.
    let userContent: any = texto || "(adjuntó una imagen)";
    if (imagenB64) {
      const dataUrl = imagenB64.startsWith("data:")
        ? imagenB64
        : `data:image/png;base64,${imagenB64}`;
      userContent = [
        { type: "text", text: texto || "Analiza esta captura y extrae los datos del producto." },
        { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
      ];
    }

    // Llamar OpenAI con function calling
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        ...systemMessages,
        ...historialMessages,
        { role: "user", content: userContent },
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

    // Anti-duplicados: si ya existe un hábito activo con nombre similar, no crear otro
    const { data: existentes } = await sb.from("habitos")
      .select("id, nombre, hora_desde, hora_hasta")
      .eq("espacio_id", espacioId).eq("archivado", false);
    const nombreLower = nombre.toLowerCase();
    const yaExiste = (existentes ?? []).find((h: any) =>
      h.nombre.toLowerCase() === nombreLower ||
      h.nombre.toLowerCase().includes(nombreLower) ||
      nombreLower.includes(h.nombre.toLowerCase())
    );
    if (yaExiste) {
      const ya = yaExiste as any;
      const horaActual = ya.hora_desde ? ` (a las ${ya.hora_desde.slice(0,5)})` : "";
      return `Ya tienes el hábito "${ya.nombre}"${horaActual}. Si quieres cambiarle la hora dime "cambia el horario de ${ya.nombre} a X". O si quieres agregarlo igual, dame un nombre distinto.`;
    }

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

  // ========== BORRAR / EDITAR ==========

  if (fn === "borrar_transaccion") {
    const buscado = String(args.descripcion_o_categoria ?? "").toLowerCase();
    let q = sb.from("transacciones")
      .select("id, fecha, monto, descripcion, categorias(nombre)")
      .eq("espacio_id", espacioId);
    if (args.fecha) q = q.eq("fecha", args.fecha);
    else q = q.gte("fecha", sumarDias7(hoyIso(), -7));
    const { data: txs } = await q.order("fecha", { ascending: false });
    const matches = (txs ?? []).filter((t: any) => {
      const desc = (t.descripcion ?? "").toLowerCase();
      const cat = (t.categorias?.nombre ?? "").toLowerCase();
      const matchTexto = desc.includes(buscado) || buscado.includes(desc) || cat.includes(buscado) || buscado.includes(cat);
      const matchMonto = !args.monto || Number(t.monto) === Number(args.monto);
      return matchTexto && matchMonto;
    });
    if (matches.length === 0) return `⚠️ No encontré una transacción que coincida con "${args.descripcion_o_categoria}"`;
    if (matches.length > 1 && args.todos !== true) {
      const lista = matches.slice(0, 5).map((t: any) => `${t.fecha} · ${t.descripcion ?? t.categorias?.nombre} · $${Number(t.monto).toLocaleString("es-CO")}`).join("\n");
      return `Hay ${matches.length} que coinciden:\n${lista}\n\n¿Borro TODAS? Dime "sí" o sé más específico.`;
    }
    const ids = (matches as any[]).map(m => m.id);
    await sb.from("transacciones").delete().in("id", ids);
    if (matches.length === 1) {
      const e = matches[0] as any;
      return `🗑️ Borré: "${e.descripcion ?? e.categorias?.nombre}" del ${e.fecha} ($${Number(e.monto).toLocaleString("es-CO")})`;
    }
    return `🗑️ Borré ${matches.length} transacciones.`;
  }

  if (fn === "editar_transaccion") {
    const buscado = String(args.texto_busqueda ?? "").toLowerCase();
    let q = sb.from("transacciones")
      .select("id, fecha, monto, descripcion, categorias(nombre)")
      .eq("espacio_id", espacioId);
    if (args.fecha_busqueda) q = q.eq("fecha", args.fecha_busqueda);
    else q = q.gte("fecha", sumarDias7(hoyIso(), -7));
    const { data: txs } = await q.order("fecha", { ascending: false });
    const matches = (txs ?? []).filter((t: any) => {
      const desc = (t.descripcion ?? "").toLowerCase();
      const cat = (t.categorias?.nombre ?? "").toLowerCase();
      const matchTexto = desc.includes(buscado) || buscado.includes(desc) || cat.includes(buscado) || buscado.includes(cat);
      const matchMonto = !args.monto_busqueda || Number(t.monto) === Number(args.monto_busqueda);
      return matchTexto && matchMonto;
    });
    if (matches.length === 0) return `⚠️ No encontré una transacción que coincida con "${args.texto_busqueda}"`;
    if (matches.length > 1) {
      const lista = matches.slice(0, 5).map((t: any) => `${t.fecha} · ${t.descripcion ?? t.categorias?.nombre} · $${Number(t.monto).toLocaleString("es-CO")}`).join("\n");
      return `Hay ${matches.length} que coinciden, sé más específico:\n${lista}`;
    }
    const elegida = matches[0] as any;
    const upd: any = {};
    if (args.nuevo_monto !== undefined && args.nuevo_monto !== null) upd.monto = Number(args.nuevo_monto);
    if (args.nueva_descripcion) upd.descripcion = args.nueva_descripcion;
    if (args.nueva_fecha) upd.fecha = args.nueva_fecha;
    if (args.nueva_categoria) {
      const { data: cats } = await sb.from("categorias").select("id, nombre").eq("espacio_id", espacioId);
      const nuevaCat = (cats ?? []).find((c: any) => c.nombre.toLowerCase() === String(args.nueva_categoria).toLowerCase())
        ?? (cats ?? []).find((c: any) => c.nombre.toLowerCase().includes(String(args.nueva_categoria).toLowerCase()));
      if (nuevaCat) upd.categoria_id = nuevaCat.id;
    }
    if (Object.keys(upd).length === 0) return "⚠️ No me dijiste qué cambiar.";
    await sb.from("transacciones").update(upd).eq("id", elegida.id);
    const cambios = Object.keys(upd).map(k => k.replace("_", " ")).join(", ");
    return `✏️ Edité la transacción "${elegida.descripcion ?? elegida.categorias?.nombre}". Cambié: ${cambios}.`;
  }

  if (fn === "borrar_tarea") {
    const buscado = String(args.texto_tarea ?? "").toLowerCase();
    const fecha = args.fecha ?? hoyIso();
    const { data: tareas } = await sb.from("tareas").select("id, titulo, fecha, hora_inicio")
      .eq("espacio_id", espacioId).eq("fecha", fecha);
    const matches = (tareas ?? []).filter((t: any) => {
      const titulo = (t.titulo ?? "").toLowerCase();
      return titulo.includes(buscado) || buscado.includes(titulo);
    });
    if (matches.length === 0) return `⚠️ No encontré una tarea que coincida con "${args.texto_tarea}" en ${fecha}`;
    if (matches.length > 1 && args.todos !== true) {
      const lista = matches.slice(0, 5).map((t: any) => `${t.titulo}${t.hora_inicio ? ` (${t.hora_inicio.slice(0,5)})` : ""}`).join(", ");
      return `Hay ${matches.length}: ${lista}. ¿Borro TODAS? Dime "sí" o sé más específico.`;
    }
    const ids = (matches as any[]).map(m => m.id);
    await sb.from("tareas").delete().in("id", ids);
    if (matches.length === 1) return `🗑️ Borré la tarea: "${(matches[0] as any).titulo}"`;
    return `🗑️ Borré ${matches.length} tareas.`;
  }

  if (fn === "editar_tarea") {
    const buscado = String(args.texto_busqueda ?? "").toLowerCase();
    let q = sb.from("tareas").select("id, titulo, fecha, hora_inicio, duracion_min")
      .eq("espacio_id", espacioId);
    if (args.fecha_busqueda) q = q.eq("fecha", args.fecha_busqueda);
    else {
      q = q.gte("fecha", sumarDias7(hoyIso(), -7)).lte("fecha", sumarDias7(hoyIso(), 7));
    }
    const { data: tareas } = await q;
    const matches = (tareas ?? []).filter((t: any) => {
      const titulo = (t.titulo ?? "").toLowerCase();
      return titulo.includes(buscado) || buscado.includes(titulo);
    });
    if (matches.length === 0) return `⚠️ No encontré una tarea que coincida con "${args.texto_busqueda}"`;
    if (matches.length > 1) {
      const lista = matches.slice(0, 5).map((t: any) => `${t.fecha} · ${t.titulo}${t.hora_inicio ? ` (${t.hora_inicio.slice(0,5)})` : ""}`).join("\n");
      return `Hay ${matches.length} tareas, sé más específico:\n${lista}`;
    }
    const elegida = matches[0] as any;
    const upd: any = {};
    if (args.nuevo_titulo) upd.titulo = args.nuevo_titulo;
    if (args.nueva_hora) upd.hora_inicio = `${args.nueva_hora}:00`;
    if (args.nueva_fecha) upd.fecha = args.nueva_fecha;
    if (args.nueva_duracion_min !== undefined && args.nueva_duracion_min !== null) upd.duracion_min = Number(args.nueva_duracion_min);
    if (Object.keys(upd).length === 0) return "⚠️ No me dijiste qué cambiar.";
    await sb.from("tareas").update(upd).eq("id", elegida.id);
    return `✏️ Edité "${elegida.titulo}". Cambié: ${Object.keys(upd).join(", ")}.`;
  }

  if (fn === "crear_pago_programado") {
    const nombre = String(args.nombre ?? "").trim();
    const monto = Number(args.monto);
    const dia = Number(args.dia_pago);
    if (!nombre) throw new Error("Falta el nombre");
    if (!monto || monto <= 0) throw new Error("Monto inválido");
    if (!dia || dia < 1 || dia > 31) throw new Error("Día inválido (1-31)");
    const recurrencia = (args.recurrencia ?? "mensual") as string;

    // Anti-duplicado: no crear si ya existe uno con el mismo nombre
    const { data: existe } = await sb.from("pagos_programados")
      .select("id, nombre, monto, dia_pago")
      .eq("espacio_id", espacioId).eq("activo", true).ilike("nombre", nombre).maybeSingle();
    if (existe) {
      const e = existe as any;
      return `Ya tienes un pago "${e.nombre}" de $${Number(e.monto).toLocaleString("es-CO")} el día ${e.dia_pago}. Si quieres editarlo dime "cambia el monto/día de ${e.nombre}".`;
    }

    // Buscar categoría tipo pago_programado (la primera) para asignar
    const { data: cats } = await sb.from("categorias").select("id").eq("espacio_id", espacioId)
      .in("tipo", ["pago_programado", "suscripcion"]).limit(1);
    const categoriaId = (cats && cats.length > 0) ? cats[0].id : null;

    const { error } = await sb.from("pagos_programados").insert({
      espacio_id: espacioId, nombre, monto, dia_pago: dia,
      recurrencia, categoria_id: categoriaId, activo: true,
    });
    if (error) throw error;
    return `🔔 Listo, agregué "${nombre}" — $${monto.toLocaleString("es-CO")} cada mes el día ${dia}. Te aviso 2 días antes para que no se te olvide.`;
  }

  if (fn === "borrar_habito") {
    const buscado = String(args.texto_habito ?? "").toLowerCase();
    const { data: habitos } = await sb.from("habitos").select("id, nombre")
      .eq("espacio_id", espacioId).eq("archivado", false);
    const matches = (habitos ?? []).filter((h: any) => {
      const n = (h.nombre ?? "").toLowerCase();
      return n.includes(buscado) || buscado.includes(n);
    });
    if (matches.length === 0) return `⚠️ No encontré un hábito que coincida con "${args.texto_habito}"`;
    // Si el usuario pidió 'todos', borrar todos los matches
    if (matches.length > 1 && args.todos !== true) {
      const lista = matches.map((h: any) => h.nombre).join(", ");
      return `Hay ${matches.length} hábitos: ${lista}. ¿Quieres que borre TODOS? Dime "sí, borra todos" o sé más específico.`;
    }
    const ids = (matches as any[]).map(m => m.id);
    await sb.from("habitos").update({ archivado: true }).in("id", ids);
    // También borrar las tareas futuras vinculadas a esos hábitos
    await sb.from("tareas").delete().in("habito_id", ids).gte("fecha", hoyIso());
    if (matches.length === 1) {
      return `🗑️ Archivé el hábito "${(matches[0] as any).nombre}" y eliminé sus tareas futuras.`;
    }
    return `🗑️ Archivé ${matches.length} hábitos (${matches.map((m: any) => m.nombre).join(", ")}) y eliminé sus tareas futuras.`;
  }

  // ============================================================
  // PRODUCTOS — handlers
  // ============================================================
  if (fn === "listar_productos") {
    let q = sb.from("emp_productos")
      .select("id, nombre, proveedor, estado, costo_proveedor, precio_final, stock, pais, plataforma")
      .eq("espacio_id", espacioId)
      .order("updated_at", { ascending: false })
      .limit(15);
    if (args.estado) q = q.eq("estado", args.estado);
    if (args.q) q = q.or(`nombre.ilike.%${args.q}%,proveedor.ilike.%${args.q}%`);
    const { data: prods } = await q;
    if (!prods || prods.length === 0) {
      return args.estado ? `No tienes productos en "${args.estado}".` : "No encontré productos con esa búsqueda.";
    }
    const lines = prods.map((p: any) => {
      const margen = p.precio_final && p.costo_proveedor ? ` · margen ${Math.round(((p.precio_final - p.costo_proveedor) / p.precio_final) * 100)}%` : "";
      return `• ${p.nombre}${p.proveedor ? ` (${p.proveedor})` : ""} — ${p.estado}${margen}`;
    });
    return `📦 Productos:\n${lines.join("\n")}`;
  }

  if (fn === "crear_producto") {
    const nombre = String(args.nombre ?? "").trim();
    if (!nombre) throw new Error("Falta el nombre del producto");
    const payload: any = {
      espacio_id: espacioId,
      nombre,
      proveedor: args.proveedor || null,
      pais: args.pais || null,
      responsable: args.responsable || null,
      costo_proveedor: args.costo_proveedor ?? null,
      precio_final: args.precio_final ?? null,
      precio_2und: args.precio_2und ?? null,
      precio_x3: args.precio_x3 ?? null,
      stock: args.stock ?? 0,
      link_landing: args.link_landing || null,
      link_drive: args.link_drive || null,
      link_creativos: args.link_creativos || null,
      plataforma: args.plataforma || "TT+FB",
      tipo: args.tipo || "dropshipping",
      estado: args.estado || "nuevo",
      fecha_activacion_tt: args.fecha_activacion_tt || null,
      fecha_activacion_fb: args.fecha_activacion_fb || null,
      observacion: args.observacion || null,
    };
    const { data, error } = await sb.from("emp_productos").insert(payload).select("id, nombre, estado").single();
    if (error) throw new Error(error.message);
    const faltantes: string[] = [];
    if (!payload.costo_proveedor) faltantes.push("costo proveedor");
    if (!payload.precio_final) faltantes.push("precio");
    if (!payload.proveedor) faltantes.push("proveedor");
    if (!payload.link_landing) faltantes.push("landing");
    const faltMsg = faltantes.length ? ` ⚠️ Faltan: ${faltantes.join(", ")}.` : "";
    return `✅ Creé "${data.nombre}" en estado "${data.estado}".${faltMsg}`;
  }

  if (fn === "actualizar_producto") {
    const q = String(args.texto_busqueda ?? "").trim().toLowerCase();
    if (!q) throw new Error("Falta texto_busqueda");
    const { data: matches } = await sb.from("emp_productos")
      .select("id, nombre, observacion").eq("espacio_id", espacioId).ilike("nombre", `%${q}%`).limit(5);
    if (!matches || matches.length === 0) return `No encontré ningún producto con "${args.texto_busqueda}".`;
    if (matches.length > 1) {
      return `Hay ${matches.length} productos con ese nombre: ${matches.map((m: any) => `"${m.nombre}"`).join(", ")}. Sé más específico.`;
    }
    const prod = matches[0] as any;
    const updates: any = {};
    const camposSimples = [
      "proveedor", "pais", "responsable",
      "costo_proveedor", "precio_final", "precio_2und", "precio_x3", "stock",
      "link_landing", "link_drive", "link_creativos",
      "plataforma", "fecha_activacion_tt", "fecha_activacion_fb",
    ];
    for (const c of camposSimples) if (args[c] !== undefined && args[c] !== null) updates[c] = args[c];
    // observacion (reemplazar) tiene prioridad sobre observacion_append
    if (args.observacion !== undefined && args.observacion !== null) {
      updates.observacion = args.observacion;
    } else if (args.observacion_append) {
      const prev = (prod.observacion ?? "").trim();
      updates.observacion = prev ? `${prev}\n\n— ${args.observacion_append}` : args.observacion_append;
    }
    if (Object.keys(updates).length === 0) return "No me diste qué campos cambiar.";
    const { error } = await sb.from("emp_productos").update(updates).eq("id", prod.id);
    if (error) throw new Error(error.message);
    const cambios = Object.keys(updates).join(", ");
    return `✏️ Actualicé "${prod.nombre}" (${cambios}).`;
  }

  if (fn === "cambiar_estado_producto") {
    const q = String(args.texto_busqueda ?? "").trim().toLowerCase();
    if (!q) throw new Error("Falta texto_busqueda");
    const { data: matches } = await sb.from("emp_productos")
      .select("id, nombre, estado, observacion").eq("espacio_id", espacioId).ilike("nombre", `%${q}%`).limit(5);
    if (!matches || matches.length === 0) return `No encontré producto con "${args.texto_busqueda}".`;
    if (matches.length > 1) {
      return `Hay ${matches.length} productos con ese nombre: ${matches.map((m: any) => `"${m.nombre}"`).join(", ")}. Sé más específico.`;
    }
    const prod = matches[0] as any;
    const updates: any = { estado: args.nuevo_estado };
    if (args.motivo) {
      const prev = (prod.observacion ?? "").trim();
      const linea = `[${hoyIso()}] ${prod.estado} → ${args.nuevo_estado}: ${args.motivo}`;
      updates.observacion = prev ? `${prev}\n${linea}` : linea;
    }
    const { error } = await sb.from("emp_productos").update(updates).eq("id", prod.id);
    if (error) throw new Error(error.message);
    return `🔄 Moví "${prod.nombre}" de ${prod.estado} → ${args.nuevo_estado}.`;
  }

  // ============================================================
  // TAREAS EMPRESARIALES — handlers
  // ============================================================
  if (fn === "crear_tarea_emp") {
    const titulo = String(args.titulo ?? "").trim();
    if (!titulo) throw new Error("Falta el título de la tarea");
    let producto_id: string | null = null;
    if (args.producto_nombre) {
      const q = String(args.producto_nombre).trim().toLowerCase();
      const { data: prods } = await sb.from("emp_productos")
        .select("id, nombre").eq("espacio_id", espacioId).ilike("nombre", `%${q}%`).limit(1);
      if (prods?.[0]) producto_id = prods[0].id;
    }
    const payload: any = {
      espacio_id: espacioId,
      titulo,
      descripcion: args.descripcion || null,
      estado: args.estado || "pendiente",
      prioridad: args.prioridad || "media",
      asignado: args.asignado || null,
      fecha_limite: args.fecha_limite || null,
      producto_id,
      completada_at: args.estado === "hecha" ? new Date().toISOString() : null,
    };
    const { data, error } = await sb.from("emp_tareas").insert(payload).select("titulo, prioridad").single();
    if (error) throw new Error(error.message);
    const extras: string[] = [];
    if (args.asignado) extras.push(`asignada a ${args.asignado}`);
    if (args.fecha_limite) extras.push(`fecha ${args.fecha_limite}`);
    if (data.prioridad === "urgente" || data.prioridad === "alta") extras.push(`prioridad ${data.prioridad}`);
    return `✅ Tarea creada: "${data.titulo}"${extras.length ? ` (${extras.join(", ")})` : ""}.`;
  }

  if (fn === "completar_tarea_emp") {
    const q = String(args.texto_tarea ?? "").trim().toLowerCase();
    if (!q) throw new Error("Falta texto_tarea");
    const { data: matches } = await sb.from("emp_tareas")
      .select("id, titulo, estado").eq("espacio_id", espacioId).ilike("titulo", `%${q}%`).neq("estado", "hecha").limit(5);
    if (!matches || matches.length === 0) return `No encontré tarea pendiente con "${args.texto_tarea}".`;
    if (matches.length > 1) {
      return `Hay ${matches.length} tareas con ese texto: ${matches.map((m: any) => `"${m.titulo}"`).join(", ")}. Sé más específico.`;
    }
    const t = matches[0] as any;
    const { error } = await sb.from("emp_tareas")
      .update({ estado: "hecha", completada_at: new Date().toISOString() }).eq("id", t.id);
    if (error) throw new Error(error.message);
    return `✅ Marqué como hecha: "${t.titulo}".`;
  }

  if (fn === "listar_tareas_emp") {
    let qb = sb.from("emp_tareas")
      .select("titulo, estado, prioridad, asignado, fecha_limite")
      .eq("espacio_id", espacioId)
      .order("fecha_limite", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(20);
    if (args.estado) qb = qb.eq("estado", args.estado);
    if (args.prioridad) qb = qb.eq("prioridad", args.prioridad);
    if (args.asignado) qb = qb.ilike("asignado", `%${args.asignado}%`);
    const { data: ts } = await qb;
    if (!ts || ts.length === 0) {
      return args.estado === "hecha"
        ? "No hay tareas hechas todavía."
        : "¡Cero tareas pendientes! 🎉";
    }
    const lines = ts.map((t: any) => {
      const pr = t.prioridad === "urgente" ? "🔥 " : t.prioridad === "alta" ? "⚠️ " : "";
      const asig = t.asignado ? ` (${t.asignado})` : "";
      const fl = t.fecha_limite ? ` · ${t.fecha_limite}` : "";
      const est = t.estado === "hecha" ? "✅" : t.estado === "en_progreso" ? "🟡" : "⚪";
      return `${est} ${pr}${t.titulo}${asig}${fl}`;
    });
    return `📋 Tareas:\n${lines.join("\n")}`;
  }

  if (fn === "borrar_tarea_emp") {
    const q = String(args.texto_tarea ?? "").trim().toLowerCase();
    if (!q) throw new Error("Falta texto_tarea");
    const { data: matches } = await sb.from("emp_tareas")
      .select("id, titulo").eq("espacio_id", espacioId).ilike("titulo", `%${q}%`).limit(5);
    if (!matches || matches.length === 0) return `No encontré tarea con "${args.texto_tarea}".`;
    if (matches.length > 1) {
      return `Hay ${matches.length} tareas con ese texto: ${matches.map((m: any) => `"${m.titulo}"`).join(", ")}. Sé más específico.`;
    }
    const t = matches[0] as any;
    const { error } = await sb.from("emp_tareas").delete().eq("id", t.id);
    if (error) throw new Error(error.message);
    return `🗑️ Borré la tarea "${t.titulo}".`;
  }

  return "";
}

// Helper local: suma días a un ISO date
function sumarDias7(iso: string, dias: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
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
