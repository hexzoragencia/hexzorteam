-- Hexzor — Objetivos / metas (Fase Productividad)
-- Pegar en Supabase → SQL Editor → Run. Es seguro re-ejecutar.

create table if not exists public.objetivos (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  titulo text not null,
  descripcion text,
  tipo text not null default 'proyecto' check (tipo in ('financiero','proyecto','personal')),
  estado text not null default 'en_progreso' check (estado in ('backlog','en_progreso','completado','pausado','cancelado')),
  ingreso_esperado numeric(14,2),
  ganancia_esperada numeric(14,2),
  cantidad int default 1,
  progreso int default 0 check (progreso between 0 and 100),
  fecha_limite date,
  orden int default 0,
  created_at timestamptz default now(),
  completado_at timestamptz
);
create index if not exists idx_objetivos_esp on public.objetivos(espacio_id, estado);

create table if not exists public.objetivo_subtareas (
  id uuid primary key default gen_random_uuid(),
  objetivo_id uuid not null references public.objetivos(id) on delete cascade,
  titulo text not null,
  completada bool default false,
  orden int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_subtareas_obj on public.objetivo_subtareas(objetivo_id);

alter table public.objetivos enable row level security;
alter table public.objetivo_subtareas enable row level security;

drop policy if exists "objetivos_member_all" on public.objetivos;
create policy "objetivos_member_all" on public.objetivos for all
  using (public.es_miembro(espacio_id))
  with check (public.es_miembro(espacio_id));

drop policy if exists "subtareas_member_all" on public.objetivo_subtareas;
create policy "subtareas_member_all" on public.objetivo_subtareas for all
  using (public.es_miembro((select espacio_id from public.objetivos where id = objetivo_id)))
  with check (public.es_miembro((select espacio_id from public.objetivos where id = objetivo_id)));
