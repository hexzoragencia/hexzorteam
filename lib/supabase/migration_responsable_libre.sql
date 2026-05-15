-- ============================================================
-- RESPONSABLE LIBRE: convertir responsable_id (FK) → responsable (texto)
-- Esto permite escribir nombres de personas que NO son miembros
-- registrados de la app (Valentina, Sebas, proveedores, etc.).
-- Idempotente. Pega en Supabase → SQL Editor → Run.
-- ============================================================

-- 1) Agregar la nueva columna de texto
alter table public.emp_productos
  add column if not exists responsable text;

-- 2) Migrar datos existentes: copia el nombre del perfil al nuevo campo
update public.emp_productos p
set responsable = perfiles.nombre
from public.perfiles
where perfiles.id = p.responsable_id
  and p.responsable is null;

-- 3) Eliminar la FK y la columna vieja
alter table public.emp_productos
  drop column if exists responsable_id;
