import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPushAPerfil, type PayloadPush } from "@/lib/push";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Llamado por pg_cron de Supabase cada 5 minutos.
// Decide qué notificaciones mandar y las dispara.
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "no auth" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Llamamos a una RPC SQL que computa todo y devuelve los candidatos
  // ya filtrados (sin duplicados con notificaciones_enviadas)
  const { data: candidatos, error } = await admin.rpc("notificaciones_a_enviar");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Candidato = {
    perfil_id: string;
    evento_tipo: string;
    evento_ref: string | null;
    titulo: string;
    cuerpo: string;
    url: string;
    fecha: string; // YYYY-MM-DD en zona Bogota
  };

  const lista = (candidatos ?? []) as Candidato[];
  const resumen = {
    total_candidatos: lista.length,
    enviados: 0,
    fallidos: 0,
    sin_dispositivo: 0,
    duplicados: 0,
    por_tipo: {} as Record<string, number>,
  };

  for (const c of lista) {
    resumen.por_tipo[c.evento_tipo] = (resumen.por_tipo[c.evento_tipo] ?? 0) + 1;

    // Intentar registrar el envío ANTES de mandar (claim atómico via unique constraint)
    const { error: errLog } = await admin
      .from("notificaciones_enviadas")
      .insert({
        perfil_id: c.perfil_id,
        evento_tipo: c.evento_tipo,
        evento_ref: c.evento_ref,
        fecha: c.fecha,
        exito: true,
      });

    if (errLog) {
      // Conflicto en unique → ya se mandó (otro proceso paralelo)
      if (errLog.code === "23505") {
        resumen.duplicados++;
        continue;
      }
      resumen.fallidos++;
      console.warn("[cron] error log", errLog.message);
      continue;
    }

    // Mandar push
    const payload: PayloadPush = {
      title: c.titulo,
      body: c.cuerpo,
      url: c.url,
      tag: `${c.evento_tipo}-${c.evento_ref ?? "all"}`,
    };

    try {
      const r = await enviarPushAPerfil(c.perfil_id, payload);
      if (r.enviados === 0) {
        resumen.sin_dispositivo++;
        // Marcar como fallido para reintentar mañana (borrando log) o dejar — dejamos
      } else {
        resumen.enviados++;
      }
    } catch (e) {
      resumen.fallidos++;
      const err = e as Error;
      // Marcar el log como fallido
      await admin
        .from("notificaciones_enviadas")
        .update({ exito: false, detalle: err.message })
        .eq("perfil_id", c.perfil_id)
        .eq("evento_tipo", c.evento_tipo)
        .eq("fecha", c.fecha);
    }
  }

  return NextResponse.json({ ok: true, ...resumen });
}

// GET para debug / ping manual (también requiere secret)
export async function GET(req: NextRequest) {
  return POST(req);
}
