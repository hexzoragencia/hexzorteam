-- ============================================================
-- TAREAS EMPRESARIALES — planificación del equipo
-- Tarea suelta del equipo: pendientes, asignación, fechas límite.
-- Distinto de la tabla 'tareas' que es para la planeación personal.
-- Idempotente.
-- ============================================================

create table if not exists public.emp_tareas (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  created_by uuid references public.perfiles(id) on delete set null,
  titulo text not null,
  descripcion text,
  estado text not null default 'pendiente' check (estado in ('pendiente','en_progreso','hecha')),
  prioridad text not null default 'media' check (prioridad in ('baja','media','alta','urgente')),
  asignado text,
  fecha_limite date,
  producto_id uuid references public.emp_productos(id) on delete set null,
  completada_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_emp_tareas_espacio on public.emp_tareas(espacio_id, estado);
create index if not exists idx_emp_tareas_fecha on public.emp_tareas(espacio_id, fecha_limite) where fecha_limite is not null;

alter table public.emp_tareas enable row level security;
drop policy if exists "emp_tareas_miembro" on public.emp_tareas;
create policy "emp_tareas_miembro" on public.emp_tareas for all
  using (public.es_miembro(espacio_id) or public.es_superadmin())
  with check (public.es_miembro(espacio_id) or public.es_superadmin());

-- Auto-actualizar updated_at
drop trigger if exists trg_emp_tareas_updated on public.emp_tareas;
create trigger trg_emp_tareas_updated before update on public.emp_tareas
  for each row execute function public.set_emp_updated_at();
