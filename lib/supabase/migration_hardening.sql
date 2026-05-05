-- Hexzor — Hardening: RLS en espacios + UNIQUE constraint en clases
-- Idempotente. Pegar TODO en Supabase → SQL Editor → Run.

-- ============================================================
-- 1. Helpers con search_path explícito y subquery para auth.uid()
-- ============================================================
create or replace function public.es_miembro(esp_id uuid) returns bool
language sql security definer stable
set search_path = public, pg_temp as $$
  select exists(
    select 1 from public.espacio_miembros
    where espacio_id = esp_id and perfil_id = (select auth.uid())
  );
$$;

create or replace function public.es_owner(esp_id uuid) returns bool
language sql security definer stable
set search_path = public, pg_temp as $$
  select exists(
    select 1 from public.espacio_miembros
    where espacio_id = esp_id and perfil_id = (select auth.uid()) and rol = 'owner'
  );
$$;

-- ============================================================
-- 2. Reactivar RLS en `espacios` (estaba desactivado)
-- ============================================================
alter table public.espacios enable row level security;

drop policy if exists "espacios_select_member_or_admin" on public.espacios;
drop policy if exists "espacios_select" on public.espacios;
drop policy if exists "espacios_all_authenticated" on public.espacios;
create policy "espacios_select_member_or_admin" on public.espacios for select using (
  public.es_miembro(id) or public.es_superadmin()
);

drop policy if exists "espacios_insert" on public.espacios;
create policy "espacios_insert" on public.espacios for insert with check (
  (select auth.uid()) is not null
);

drop policy if exists "espacios_update" on public.espacios;
create policy "espacios_update" on public.espacios for update using (
  public.es_owner(id) or public.es_superadmin()
);

drop policy if exists "espacios_delete" on public.espacios;
create policy "espacios_delete" on public.espacios for delete using (
  public.es_owner(id) or public.es_superadmin()
);

-- ============================================================
-- 3. Reactivar RLS en `espacio_miembros`
-- ============================================================
alter table public.espacio_miembros enable row level security;

drop policy if exists "espacio_miembros_select" on public.espacio_miembros;
drop policy if exists "espacio_miembros_all_authenticated" on public.espacio_miembros;
create policy "espacio_miembros_select" on public.espacio_miembros for select using (
  perfil_id = (select auth.uid())
  or public.es_miembro(espacio_id)
  or public.es_superadmin()
);

drop policy if exists "espacio_miembros_insert" on public.espacio_miembros;
create policy "espacio_miembros_insert" on public.espacio_miembros for insert with check (
  (select auth.uid()) is not null
);

drop policy if exists "espacio_miembros_update" on public.espacio_miembros;
create policy "espacio_miembros_update" on public.espacio_miembros for update using (
  public.es_owner(espacio_id) or public.es_superadmin()
);

drop policy if exists "espacio_miembros_delete" on public.espacio_miembros;
create policy "espacio_miembros_delete" on public.espacio_miembros for delete using (
  public.es_owner(espacio_id) or public.es_superadmin()
);

-- ============================================================
-- 4. Renumerar clases existentes y agregar UNIQUE constraint
-- ============================================================
-- Si hay clases con numero_orden duplicado, las renumera por created_at
with renumerados as (
  select id, row_number() over (partition by estudiante_id order by created_at, id) as nuevo
  from public.mentorias_clases
)
update public.mentorias_clases mc
set numero_orden = r.nuevo
from renumerados r where mc.id = r.id;

alter table public.mentorias_clases drop constraint if exists mentorias_clases_orden_unique;
alter table public.mentorias_clases add constraint mentorias_clases_orden_unique
  unique (estudiante_id, numero_orden);
