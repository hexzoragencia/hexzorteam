-- Hexzor — Planeación diaria + Pomodoro
-- Pegar en Supabase → SQL Editor → Run. Es seguro re-ejecutar.

create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  objetivo_id uuid references public.objetivos(id) on delete set null,
  titulo text not null,
  descripcion text,
  fecha date not null,
  hora_inicio time,             -- NULL = todo el día / sin hora específica
  duracion_min int default 30 check (duracion_min between 15 and 720),
  tipo text not null default 'tarea' check (tipo in ('tarea','reunion','bloqueo','personal')),
  notas text,
  completada bool default false,
  completada_at timestamptz,
  orden int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_tareas_esp_fecha on public.tareas(espacio_id, fecha);

create table if not exists public.pomodoro_sesiones (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  tarea_id uuid references public.tareas(id) on delete set null,
  inicio timestamptz not null default now(),
  fin timestamptz,
  duracion_planeada_min int default 25 check (duracion_planeada_min between 1 and 180),
  duracion_real_min int,
  tipo text not null default 'trabajo' check (tipo in ('trabajo','descanso')),
  completada bool default false,
  created_at timestamptz default now()
);
create index if not exists idx_pomo_esp_inicio on public.pomodoro_sesiones(espacio_id, inicio desc);

alter table public.tareas enable row level security;
alter table public.pomodoro_sesiones enable row level security;

drop policy if exists "tareas_member_all" on public.tareas;
create policy "tareas_member_all" on public.tareas for all
  using (public.es_miembro(espacio_id))
  with check (public.es_miembro(espacio_id));

drop policy if exists "pomo_member_all" on public.pomodoro_sesiones;
create policy "pomo_member_all" on public.pomodoro_sesiones for all
  using (public.es_miembro(espacio_id))
  with check (public.es_miembro(espacio_id));
