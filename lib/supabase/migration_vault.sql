-- ============================================================
-- BÓVEDA DE ACCESOS v2 — código secreto + RLS para miembros
-- Idempotente. Puede correrse múltiples veces sin romper nada.
-- ============================================================

-- 1) Columnas de bóveda en espacios
alter table public.espacios
  add column if not exists vault_pin_hash text,
  add column if not exists vault_pin_salt text,
  add column if not exists vault_failed_attempts int not null default 0,
  add column if not exists vault_locked_until timestamptz;

-- 2) Reset de la tabla de accesos (el usuario eligió empezar de cero).
--    Borra los 14 importados del Excel para arrancar limpio.
truncate table public.emp_accesos restart identity;

-- 3) Quitar el CHECK rígido de plataforma — ahora las categorías son libres.
alter table public.emp_accesos
  drop constraint if exists emp_accesos_plataforma_check;

-- 4) Nuevas columnas: favorito, categoría libre, quién actualizó, tags.
alter table public.emp_accesos
  add column if not exists favorito boolean not null default false,
  add column if not exists categoria text,
  add column if not exists actualizado_por uuid references public.perfiles(id) on delete set null,
  add column if not exists tags text[];

-- Rellena categoria desde plataforma para compatibilidad
update public.emp_accesos set categoria = plataforma where categoria is null;

-- 5) Índices para búsqueda
create index if not exists idx_emp_accesos_categoria on public.emp_accesos(espacio_id, categoria);
create index if not exists idx_emp_accesos_favorito on public.emp_accesos(espacio_id) where favorito = true;

-- 6) RLS — ahora cualquier miembro del espacio puede ver/editar,
--    pero el acceso real a la password va por API server-side
--    (que valida la cookie de unlock).
drop policy if exists "emp_accesos_owner" on public.emp_accesos;
drop policy if exists "emp_accesos_miembro_select" on public.emp_accesos;
drop policy if exists "emp_accesos_miembro_insert" on public.emp_accesos;
drop policy if exists "emp_accesos_miembro_update" on public.emp_accesos;
drop policy if exists "emp_accesos_owner_delete" on public.emp_accesos;

create policy "emp_accesos_miembro_select" on public.emp_accesos for select
  using (public.es_miembro(espacio_id) or public.es_superadmin());

create policy "emp_accesos_miembro_insert" on public.emp_accesos for insert
  with check (public.es_miembro(espacio_id) or public.es_superadmin());

create policy "emp_accesos_miembro_update" on public.emp_accesos for update
  using (public.es_miembro(espacio_id) or public.es_superadmin())
  with check (public.es_miembro(espacio_id) or public.es_superadmin());

-- DELETE más restrictivo: solo owner/superadmin.
create policy "emp_accesos_owner_delete" on public.emp_accesos for delete
  using (public.es_owner(espacio_id) or public.es_superadmin());

-- 7) Tabla de audit log opcional (quién destrabó la bóveda, cuándo)
create table if not exists public.vault_unlock_log (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  perfil_id uuid references public.perfiles(id) on delete set null,
  exito boolean not null,
  ip text,
  user_agent text,
  created_at timestamptz default now()
);
create index if not exists idx_vault_log_espacio_fecha on public.vault_unlock_log(espacio_id, created_at desc);

alter table public.vault_unlock_log enable row level security;
drop policy if exists "vault_log_owner_select" on public.vault_unlock_log;
create policy "vault_log_owner_select" on public.vault_unlock_log for select
  using (public.es_owner(espacio_id) or public.es_superadmin());
-- Inserts solo desde el server (service role salta RLS).
