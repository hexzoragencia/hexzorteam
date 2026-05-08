-- =========================================================
-- migration_push.sql — Notificaciones push (Web Push API)
-- Idempotente: se puede correr varias veces.
-- =========================================================

-- 1) Suscripciones por dispositivo (un user puede tener varias: celular + laptop)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  creado_en   timestamptz NOT NULL DEFAULT now(),
  ultimo_uso  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_perfil ON push_subscriptions(perfil_id);

-- 2) Bitácora de envíos (evita duplicar la misma noti el mismo día)
CREATE TABLE IF NOT EXISTS notificaciones_enviadas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id     uuid NOT NULL REFERENCES perfiles(id) ON DELETE CASCADE,
  evento_tipo   text NOT NULL,           -- 'resumen_dia', 'tarea_inicio', 'tarea_proxima', 'clase_proxima', 'pagos_dia', 'test'
  evento_ref    text,                    -- id de tarea/clase/pago para evitar duplicar
  fecha         date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Bogota')::date,
  enviado_en    timestamptz NOT NULL DEFAULT now(),
  exito         boolean NOT NULL DEFAULT true,
  detalle       text
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notif_dia
  ON notificaciones_enviadas(perfil_id, evento_tipo, COALESCE(evento_ref, ''), fecha);

CREATE INDEX IF NOT EXISTS idx_notif_perfil_fecha
  ON notificaciones_enviadas(perfil_id, fecha DESC);

-- 3) RLS — solo el dueño ve/edita sus suscripciones
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones_enviadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_select_own ON push_subscriptions;
CREATE POLICY push_select_own ON push_subscriptions
  FOR SELECT USING (perfil_id = (select auth.uid()));

DROP POLICY IF EXISTS push_insert_own ON push_subscriptions;
CREATE POLICY push_insert_own ON push_subscriptions
  FOR INSERT WITH CHECK (perfil_id = (select auth.uid()));

DROP POLICY IF EXISTS push_delete_own ON push_subscriptions;
CREATE POLICY push_delete_own ON push_subscriptions
  FOR DELETE USING (perfil_id = (select auth.uid()));

DROP POLICY IF EXISTS notif_select_own ON notificaciones_enviadas;
CREATE POLICY notif_select_own ON notificaciones_enviadas
  FOR SELECT USING (perfil_id = (select auth.uid()));

-- El service role bypass RLS, así que el cron puede insertar sin policy de INSERT pública.
