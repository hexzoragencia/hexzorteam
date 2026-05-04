-- Hexzor — Mentorías y asesorías (solo superadmin)
-- Idempotente: seguro de re-ejecutar.

-- ============================================================
-- Tabla: estudiantes que tú mentoras / asesoras
-- ============================================================
create table if not exists public.mentorias_estudiantes (
  id uuid primary key default gen_random_uuid(),
  superadmin_id uuid not null references public.perfiles(id) on delete cascade,
  nombre text not null,
  contacto text,
  tipo text not null default 'mentoria' check (tipo in ('mentoria','asesoria')),
  nivel text,
  estado text not null default 'activo' check (estado in ('activo','pausado','graduado','abandonado')),
  notas text,
  fecha_inicio date default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_mentorias_est_admin on public.mentorias_estudiantes(superadmin_id);
create index if not exists idx_mentorias_est_estado on public.mentorias_estudiantes(estado);

alter table public.mentorias_estudiantes enable row level security;
drop policy if exists "mentorias_est_admin" on public.mentorias_estudiantes;
create policy "mentorias_est_admin" on public.mentorias_estudiantes for all
  using (public.es_superadmin())
  with check (public.es_superadmin());

-- ============================================================
-- Tabla: clases de cada estudiante (con fecha y hora opcional)
-- ============================================================
create table if not exists public.mentorias_clases (
  id uuid primary key default gen_random_uuid(),
  estudiante_id uuid not null references public.mentorias_estudiantes(id) on delete cascade,
  numero_orden int not null default 1,
  titulo text not null,
  descripcion text,
  fecha date,
  hora time,
  duracion_min int default 60,
  estado text not null default 'pendiente' check (estado in ('pendiente','vista','cancelada')),
  fecha_completada timestamptz,
  notas text,
  created_at timestamptz default now()
);

create index if not exists idx_mentorias_clases_estudiante on public.mentorias_clases(estudiante_id, numero_orden);
create index if not exists idx_mentorias_clases_fecha on public.mentorias_clases(fecha) where estado = 'pendiente';

alter table public.mentorias_clases enable row level security;
drop policy if exists "mentorias_clases_admin" on public.mentorias_clases;
create policy "mentorias_clases_admin" on public.mentorias_clases for all
  using (public.es_superadmin())
  with check (public.es_superadmin());

-- ============================================================
-- Trigger updated_at
-- ============================================================
create or replace function public.set_mentorias_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_mentorias_est_updated on public.mentorias_estudiantes;
create trigger trg_mentorias_est_updated before update on public.mentorias_estudiantes
  for each row execute function public.set_mentorias_updated_at();

-- ============================================================
-- Vista: stats por estudiante (clases vistas, total, próxima)
-- ============================================================
create or replace view public.mentorias_estudiantes_stats as
  select
    e.*,
    (select count(*) from public.mentorias_clases c where c.estudiante_id = e.id) as clases_total,
    (select count(*) from public.mentorias_clases c where c.estudiante_id = e.id and c.estado = 'vista') as clases_vistas,
    (select count(*) from public.mentorias_clases c where c.estudiante_id = e.id and c.estado = 'pendiente') as clases_pendientes,
    (select min(c.fecha) from public.mentorias_clases c
       where c.estudiante_id = e.id and c.estado = 'pendiente' and c.fecha >= current_date) as proxima_fecha,
    (select c.titulo from public.mentorias_clases c
       where c.estudiante_id = e.id and c.estado = 'pendiente' and c.fecha >= current_date
       order by c.fecha asc, c.hora asc nulls last limit 1) as proxima_titulo
  from public.mentorias_estudiantes e;

grant select on public.mentorias_estudiantes_stats to authenticated;

-- ============================================================
-- Vista: próximas clases para el dashboard del superadmin
-- ============================================================
create or replace view public.mentorias_proximas_clases as
  select
    c.id, c.titulo, c.descripcion, c.fecha, c.hora, c.duracion_min, c.estado,
    e.id as estudiante_id, e.nombre as estudiante_nombre, e.tipo as estudiante_tipo,
    e.nivel as estudiante_nivel, e.superadmin_id
  from public.mentorias_clases c
  join public.mentorias_estudiantes e on e.id = c.estudiante_id
  where c.estado = 'pendiente'
    and c.fecha is not null
    and c.fecha >= current_date
  order by c.fecha asc, c.hora asc nulls last;

grant select on public.mentorias_proximas_clases to authenticated;
