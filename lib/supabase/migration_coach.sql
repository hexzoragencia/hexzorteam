-- Hexzor — Coach IA (cache de consejos diarios + log de comandos)
-- Pegar en Supabase → SQL Editor → Run. Es seguro re-ejecutar.

create table if not exists public.coach_consejos (
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null,
  saludo text,
  frase text,
  fortalezas text,
  debilidades text,
  sugerencia text,
  generado_at timestamptz default now(),
  primary key (espacio_id, perfil_id, fecha)
);

alter table public.coach_consejos enable row level security;
drop policy if exists "coach_member_all" on public.coach_consejos;
create policy "coach_member_all" on public.coach_consejos for all
  using (public.es_miembro(espacio_id) and perfil_id = auth.uid())
  with check (public.es_miembro(espacio_id) and perfil_id = auth.uid());

-- Log de comandos para debugging y aprendizaje
create table if not exists public.coach_comandos (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  texto_usuario text not null,
  acciones jsonb,
  respuesta text,
  created_at timestamptz default now()
);
create index if not exists idx_comandos_esp_fecha on public.coach_comandos(espacio_id, created_at desc);

alter table public.coach_comandos enable row level security;
drop policy if exists "comandos_member_all" on public.coach_comandos;
create policy "comandos_member_all" on public.coach_comandos for all
  using (public.es_miembro(espacio_id) and perfil_id = auth.uid())
  with check (public.es_miembro(espacio_id) and perfil_id = auth.uid());
