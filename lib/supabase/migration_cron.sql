-- =========================================================
-- migration_cron.sql — pg_cron + RPC notificaciones_a_enviar
-- Idempotente: se puede correr varias veces.
--
-- ⚠️ Antes de ejecutar, REEMPLAZA los 2 placeholders:
--   <CRON_SECRET>  → el mismo secreto que pongas en Vercel env CRON_SECRET
--   <APP_URL>      → tu URL de producción, ej: https://hexzorteam.vercel.app
-- =========================================================

-- 1) Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2) Función RPC: devuelve los candidatos a notificar AHORA
--    Filtra los que ya fueron notificados (LEFT JOIN con notificaciones_enviadas).
CREATE OR REPLACE FUNCTION public.notificaciones_a_enviar()
RETURNS TABLE (
  perfil_id   uuid,
  evento_tipo text,
  evento_ref  text,
  titulo      text,
  cuerpo      text,
  url         text,
  fecha       date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ahora     timestamptz := now();
  hoy_bog   date         := (ahora AT TIME ZONE 'America/Bogota')::date;
  hora_bog  int          := extract(hour from (ahora AT TIME ZONE 'America/Bogota'))::int;
  min_bog   int          := extract(minute from (ahora AT TIME ZONE 'America/Bogota'))::int;
BEGIN
  -- ===== A. RESUMEN DEL DÍA — 7:00am ± ventana de 5 min (cubre cron a 7:00 y 7:05) =====
  IF hora_bog = 7 AND min_bog < 10 THEN
    RETURN QUERY
    WITH tareas_hoy AS (
      SELECT em.perfil_id, count(*)::int AS total
      FROM public.tareas t
      JOIN public.espacio_miembros em
        ON em.espacio_id = t.espacio_id AND em.rol = 'owner'
      WHERE t.fecha = hoy_bog
        AND t.completada = false
      GROUP BY em.perfil_id
    )
    SELECT
      th.perfil_id,
      'resumen_dia'::text,
      NULL::text,
      '☀️ Buenos días'::text,
      ('Tienes ' || th.total || (CASE WHEN th.total = 1 THEN ' tarea hoy' ELSE ' tareas hoy' END))::text,
      '/'::text,
      hoy_bog
    FROM tareas_hoy th
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notificaciones_enviadas ne
      WHERE ne.perfil_id = th.perfil_id
        AND ne.evento_tipo = 'resumen_dia'
        AND ne.fecha = hoy_bog
    );
  END IF;

  -- ===== B. PAGOS DEL DÍA — 8:00am =====
  IF hora_bog = 8 AND min_bog < 10 THEN
    RETURN QUERY
    WITH pagos_alerta AS (
      SELECT
        em.perfil_id,
        count(*) FILTER (WHERE pdm.estado = 'vencido')::int AS vencidos,
        count(*) FILTER (WHERE pdm.estado IN ('proximo','vencido') OR pdm.fecha_vencimiento = hoy_bog)::int AS urgentes,
        sum(pdm.monto) FILTER (WHERE pdm.estado IN ('proximo','vencido') OR pdm.fecha_vencimiento = hoy_bog) AS total
      FROM public.pagos_del_mes pdm
      JOIN public.espacio_miembros em
        ON em.espacio_id = pdm.espacio_id AND em.rol = 'owner'
      WHERE pdm.estado IN ('proximo','vencido')
      GROUP BY em.perfil_id
    )
    SELECT
      pa.perfil_id,
      'pagos_dia'::text,
      NULL::text,
      ('💰 ' || pa.urgentes || (CASE WHEN pa.urgentes = 1 THEN ' pago urgente' ELSE ' pagos urgentes' END))::text,
      (CASE WHEN pa.vencidos > 0
            THEN pa.vencidos || ' vencido' || (CASE WHEN pa.vencidos=1 THEN '' ELSE 's' END) || ' · Total: $' || to_char(coalesce(pa.total,0), 'FM999G999G999')
            ELSE 'Total: $' || to_char(coalesce(pa.total,0), 'FM999G999G999')
       END)::text,
      '/'::text,
      hoy_bog
    FROM pagos_alerta pa
    WHERE pa.urgentes > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.notificaciones_enviadas ne
        WHERE ne.perfil_id = pa.perfil_id
          AND ne.evento_tipo = 'pagos_dia'
          AND ne.fecha = hoy_bog
      );
  END IF;

  -- ===== C. TAREA PRÓXIMA (15 min antes) =====
  -- Ventana: tareas que empiezan en [10, 20] minutos a partir de ahora
  RETURN QUERY
  WITH tareas_proximas AS (
    SELECT
      t.id,
      t.titulo,
      t.fecha,
      t.hora_inicio,
      em.perfil_id,
      ((t.fecha + t.hora_inicio) AT TIME ZONE 'America/Bogota') AS inicio_ts
    FROM public.tareas t
    JOIN public.espacio_miembros em
      ON em.espacio_id = t.espacio_id AND em.rol = 'owner'
    WHERE t.fecha = hoy_bog
      AND t.hora_inicio IS NOT NULL
      AND t.completada = false
  )
  SELECT
    tp.perfil_id,
    'tarea_proxima'::text,
    tp.id::text,
    '⏳ Estás a 15 minutos de tu tarea'::text,
    (tp.titulo || ' · ' || to_char(tp.hora_inicio, 'FMHH12:MI AM'))::text,
    '/'::text,
    hoy_bog
  FROM tareas_proximas tp
  WHERE tp.inicio_ts BETWEEN ahora + interval '10 minutes' AND ahora + interval '20 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.notificaciones_enviadas ne
      WHERE ne.perfil_id = tp.perfil_id
        AND ne.evento_tipo = 'tarea_proxima'
        AND ne.evento_ref = tp.id::text
        AND ne.fecha = hoy_bog
    );

  -- ===== D. TAREA INICIO (a la hora exacta) =====
  -- Ventana: tareas en [-3, +3] minutos
  RETURN QUERY
  WITH tareas_ahora AS (
    SELECT
      t.id,
      t.titulo,
      t.fecha,
      t.hora_inicio,
      em.perfil_id,
      ((t.fecha + t.hora_inicio) AT TIME ZONE 'America/Bogota') AS inicio_ts
    FROM public.tareas t
    JOIN public.espacio_miembros em
      ON em.espacio_id = t.espacio_id AND em.rol = 'owner'
    WHERE t.fecha = hoy_bog
      AND t.hora_inicio IS NOT NULL
      AND t.completada = false
  )
  SELECT
    ta.perfil_id,
    'tarea_inicio'::text,
    ta.id::text,
    '⏰ Es hora de tu tarea'::text,
    (ta.titulo || ' · ' || to_char(ta.hora_inicio, 'FMHH12:MI AM'))::text,
    '/'::text,
    hoy_bog
  FROM tareas_ahora ta
  WHERE ta.inicio_ts BETWEEN ahora - interval '3 minutes' AND ahora + interval '3 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.notificaciones_enviadas ne
      WHERE ne.perfil_id = ta.perfil_id
        AND ne.evento_tipo = 'tarea_inicio'
        AND ne.evento_ref = ta.id::text
        AND ne.fecha = hoy_bog
    );

  -- ===== E. CLASE MENTORÍA (30 min antes) — solo superadmin =====
  RETURN QUERY
  WITH clases_proximas AS (
    SELECT
      c.id,
      c.titulo,
      c.fecha,
      c.hora,
      c.estudiante_id,
      e.nombre AS estudiante,
      e.superadmin_id,
      ((c.fecha + c.hora) AT TIME ZONE 'America/Bogota') AS inicio_ts
    FROM public.mentorias_clases c
    JOIN public.mentorias_estudiantes e ON e.id = c.estudiante_id
    WHERE c.fecha = hoy_bog
      AND c.hora IS NOT NULL
      AND c.estado = 'pendiente'
  )
  SELECT
    cp.superadmin_id,
    'clase_proxima'::text,
    cp.id::text,
    '📚 Tu clase empieza en 30 minutos'::text,
    (cp.estudiante || ' · ' || to_char(cp.hora, 'FMHH12:MI AM'))::text,
    '/admin/mentorias'::text,
    hoy_bog
  FROM clases_proximas cp
  WHERE cp.inicio_ts BETWEEN ahora + interval '25 minutes' AND ahora + interval '35 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.notificaciones_enviadas ne
      WHERE ne.perfil_id = cp.superadmin_id
        AND ne.evento_tipo = 'clase_proxima'
        AND ne.evento_ref = cp.id::text
        AND ne.fecha = hoy_bog
    );

  RETURN;
END;
$$;

-- Permitir que solo el service_role la pueda llamar
REVOKE ALL ON FUNCTION public.notificaciones_a_enviar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notificaciones_a_enviar() TO service_role;

-- 3) Programar el cron job cada 5 minutos
--    Si ya existe un job con el mismo nombre, lo eliminamos primero
SELECT cron.unschedule('hexzor-notificaciones')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'hexzor-notificaciones');

SELECT cron.schedule(
  'hexzor-notificaciones',
  '*/5 * * * *',
  $cmd$
  SELECT net.http_post(
    url := '<APP_URL>/api/cron/notificaciones',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CRON_SECRET>'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cmd$
);

-- 4) (Opcional) Ver el último log de pg_net para debug
-- SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;
