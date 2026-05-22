-- ============================================================
-- BORRADO SUAVE para productos
-- En vez de eliminar físicamente, marcamos archivado=true.
-- Los productos archivados se pueden restaurar después.
-- Idempotente.
-- ============================================================

alter table public.emp_productos
  add column if not exists archivado boolean not null default false;

create index if not exists idx_emp_prod_archivado
  on public.emp_productos(espacio_id) where archivado = false;
