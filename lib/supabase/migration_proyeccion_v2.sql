-- ============================================================
-- PROYECCIÓN v2 — agregar utilidad por pedido (calculadora reversa)
-- Idempotente.
-- ============================================================

alter table public.emp_metas
  add column if not exists utilidad_por_pedido numeric(14,2) default 25000;
