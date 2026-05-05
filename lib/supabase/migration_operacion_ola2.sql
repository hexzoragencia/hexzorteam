-- Hexzor — Ola 2: Páginas Ganadoras, Recursos, Bóveda de Accesos
-- Idempotente. Pegar TODO en Supabase → SQL Editor → Run.

-- ============================================================
-- 1. PÁGINAS GANADORAS — landings de la competencia/referencia por país
-- ============================================================
create table if not exists public.emp_paginas (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  created_by uuid references public.perfiles(id) on delete set null,
  pais text not null check (pais in ('CO','MX','EC','PE','GT','ES','CL','USA','VARIAS','CONOCIDAS','OTRO')),
  url text not null,
  titulo text,
  observacion text,
  created_at timestamptz default now()
);
create index if not exists idx_emp_paginas_espacio on public.emp_paginas(espacio_id, pais);

alter table public.emp_paginas enable row level security;
drop policy if exists "emp_paginas_miembro" on public.emp_paginas;
create policy "emp_paginas_miembro" on public.emp_paginas for all
  using (public.es_miembro(espacio_id))
  with check (public.es_miembro(espacio_id));

-- ============================================================
-- 2. RECURSOS — biblioteca de links útiles (creativos, GPTs, herramientas)
-- ============================================================
create table if not exists public.emp_recursos (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  created_by uuid references public.perfiles(id) on delete set null,
  categoria text not null default 'otros' check (categoria in ('creativos','hooks','gpts','herramientas','tutoriales','plantillas','otros')),
  titulo text not null,
  url text,
  descripcion text,
  created_at timestamptz default now()
);
create index if not exists idx_emp_recursos_espacio on public.emp_recursos(espacio_id, categoria);

alter table public.emp_recursos enable row level security;
drop policy if exists "emp_recursos_miembro" on public.emp_recursos;
create policy "emp_recursos_miembro" on public.emp_recursos for all
  using (public.es_miembro(espacio_id))
  with check (public.es_miembro(espacio_id));

-- ============================================================
-- 3. BÓVEDA DE ACCESOS — credenciales del equipo
-- IMPORTANTE: Solo OWNERS del espacio pueden ver/editar (RLS estricta).
-- Las contraseñas se almacenan en texto plano pero la tabla está
-- protegida por RLS — solo el owner accede.
-- ============================================================
create table if not exists public.emp_accesos (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  created_by uuid references public.perfiles(id) on delete set null,
  plataforma text not null default 'otro' check (plataforma in ('tiktok','facebook','meta_business','google','instagram','shopify','pagina','dominio','tienda','correo','banco','otro')),
  etiqueta text not null,
  persona text,
  usuario text,
  password_enc text,
  url text,
  notas text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_emp_accesos_espacio on public.emp_accesos(espacio_id, plataforma);

alter table public.emp_accesos enable row level security;
drop policy if exists "emp_accesos_owner" on public.emp_accesos;
create policy "emp_accesos_owner" on public.emp_accesos for all
  using (public.es_owner(espacio_id) or public.es_superadmin())
  with check (public.es_owner(espacio_id) or public.es_superadmin());

drop trigger if exists trg_emp_accesos_updated on public.emp_accesos;
create trigger trg_emp_accesos_updated before update on public.emp_accesos
  for each row execute function public.set_emp_updated_at();
