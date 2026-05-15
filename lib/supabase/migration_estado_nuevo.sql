-- ============================================================
-- AGREGAR ESTADO 'nuevo' al flujo de productos
-- Idempotente. Pega en Supabase → SQL Editor → Run.
-- ============================================================

-- Quitar el CHECK viejo
alter table public.emp_productos
  drop constraint if exists emp_productos_estado_check;

-- Crear el nuevo CHECK con 'nuevo' incluido
alter table public.emp_productos
  add constraint emp_productos_estado_check
  check (estado in ('nuevo','testeo','aprendizaje','validado','winner','descartado','apagado'));
