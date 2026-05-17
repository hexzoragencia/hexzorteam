-- ============================================================
-- PRODUCTOS: foto/miniatura del producto
-- Guarda una imagen pequeña (data URL comprimida o link) para
-- mostrarla al lado del nombre. Idempotente.
-- ============================================================

alter table public.emp_productos
  add column if not exists imagen_url text;
