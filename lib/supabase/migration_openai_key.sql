-- ============================================================
-- API KEY DE OPENAI POR ESPACIO
-- Cada espacio puede usar su propia API key. Si está vacía,
-- la app usa la key global del servidor (fallback).
-- La columna SOLO se lee/escribe desde el servidor (service role).
-- Idempotente.
-- ============================================================

alter table public.espacios
  add column if not exists openai_api_key text;
