-- ============================================================
-- AGREGAR ESTADO 'relanzamiento'
-- Productos que ya se testearon, no vendieron lo suficiente
-- PERO dejaron buenas métricas (CTR, engagement, CPC). Vale la
-- pena relanzarlos con cambios. Idempotente.
-- ============================================================

alter table public.emp_productos
  drop constraint if exists emp_productos_estado_check;

alter table public.emp_productos
  add constraint emp_productos_estado_check
  check (estado in ('investigado','nuevo','testeo','aprendizaje','validado','winner','relanzamiento','descartado','apagado'));
