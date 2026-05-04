-- Hexzor — Hábitos de crecimiento (Fase Productividad)
-- Pegar en Supabase → SQL Editor → Run. Es seguro re-ejecutar.

create table if not exists public.habitos (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  nombre text not null,
  emoji text default '✅',
  color text default 'azul',
  frecuencia_semanal int not null default 7 check (frecuencia_semanal between 1 and 7),
  orden int default 0,
  archivado bool default false,
  created_at timestamptz default now()
);
create index if not exists idx_habitos_esp on public.habitos(espacio_id, archivado);

create table if not exists public.habito_marcas (
  habito_id uuid not null references public.habitos(id) on delete cascade,
  fecha date not null,
  created_at timestamptz default now(),
  primary key (habito_id, fecha)
);
create index if not exists idx_habito_marcas_fecha on public.habito_marcas(fecha);

alter table public.habitos enable row level security;
alter table public.habito_marcas enable row level security;

drop policy if exists "habitos_member_all" on public.habitos;
create policy "habitos_member_all" on public.habitos for all
  using (public.es_miembro(espacio_id))
  with check (public.es_miembro(espacio_id));

drop policy if exists "habito_marcas_member_all" on public.habito_marcas;
create policy "habito_marcas_member_all" on public.habito_marcas for all
  using (public.es_miembro((select espacio_id from public.habitos where id = habito_id)))
  with check (public.es_miembro((select espacio_id from public.habitos where id = habito_id)));
