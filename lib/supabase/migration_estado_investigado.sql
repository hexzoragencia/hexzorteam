-- ============================================================
-- AGREGAR ESTADO 'investigado' al flujo de productos
-- Productos descubiertos en Shopify/Google/Alibaba/Amazon/etc.
-- (investigación de mercado, aún no se van a testear).
-- Idempotente.
-- ============================================================

alter table public.emp_productos
  drop constraint if exists emp_productos_estado_check;

alter table public.emp_productos
  add constraint emp_productos_estado_check
  check (estado in ('investigado','nuevo','testeo','aprendizaje','validado','winner','descartado','apagado'));
