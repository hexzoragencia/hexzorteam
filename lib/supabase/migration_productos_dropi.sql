-- ============================================================
-- PRODUCTOS: link de Dropi + link de referencia/competencia
-- Idempotente.
-- ============================================================

alter table public.emp_productos
  add column if not exists dropi_url text,
  add column if not exists link_referencia text;
