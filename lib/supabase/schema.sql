-- Hexzor Empresarial — schema inicial (idempotente, se puede correr varias veces)
-- Pegar TODO este SQL en Supabase → SQL Editor → Run

-- ============================================================
-- 1. PERFILES (extiende auth.users con nombre/rol)
-- ============================================================
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  email text not null,
  rol text not null default 'socio' check (rol in ('socio','admin','operador')),
  created_at timestamptz default now()
);
alter table public.perfiles enable row level security;
drop policy if exists "perfiles_select_all_authenticated" on public.perfiles;
drop policy if exists "perfiles_update_own" on public.perfiles;
create policy "perfiles_select_all_authenticated" on public.perfiles for select using (auth.uid() is not null);
create policy "perfiles_update_own" on public.perfiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.perfiles (id, nombre, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)), new.email);
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ============================================================
-- 2. MOVIMIENTOS (libro contable unificado)
-- ============================================================
create table if not exists public.movimientos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  tipo text not null check (tipo in ('ingreso','gasto_diario','gasto_fijo','inyeccion_capital')),
  monto numeric(14,2) not null check (monto >= 0),
  categoria text,
  razon text,
  responsable_id uuid references public.perfiles(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists idx_movimientos_fecha on public.movimientos(fecha desc);
create index if not exists idx_movimientos_tipo on public.movimientos(tipo);
alter table public.movimientos enable row level security;
drop policy if exists "movimientos_all_authenticated" on public.movimientos;
create policy "movimientos_all_authenticated" on public.movimientos for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ============================================================
-- 3. CONFIG DE PAÍSES (calculadora editable)
-- ============================================================
create table if not exists public.paises_config (
  code text primary key check (code in ('CO','MX','EC','ES','CL')),
  nombre text not null,
  bandera text not null,
  moneda text not null,
  flete_base numeric(14,4) not null,
  pct_entrega numeric(5,4) not null check (pct_entrega > 0 and pct_entrega <= 1),
  pct_cpa_objetivo numeric(5,4) not null check (pct_cpa_objetivo >= 0 and pct_cpa_objetivo < 1),
  pct_utilidad_objetivo numeric(5,4) not null check (pct_utilidad_objetivo >= 0 and pct_utilidad_objetivo < 1),
  pct_comparacion numeric(5,4) not null default 0.66,
  updated_at timestamptz default now()
);
alter table public.paises_config enable row level security;
drop policy if exists "paises_select_all" on public.paises_config;
drop policy if exists "paises_update_all" on public.paises_config;
drop policy if exists "paises_insert_all" on public.paises_config;
create policy "paises_select_all" on public.paises_config for select using (auth.uid() is not null);
create policy "paises_update_all" on public.paises_config for update using (auth.uid() is not null);
create policy "paises_insert_all" on public.paises_config for insert with check (auth.uid() is not null);

insert into public.paises_config (code,nombre,bandera,moneda,flete_base,pct_entrega,pct_cpa_objetivo,pct_utilidad_objetivo,pct_comparacion) values
  ('CO','Colombia','🇨🇴','COP',18500,0.65,0.55,0.20,1.00),
  ('MX','México',  '🇲🇽','MXN',145,  0.65,0.55,0.10,0.66),
  ('EC','Ecuador', '🇪🇨','USD',7,    0.70,0.60,0.10,0.66),
  ('ES','España',  '🇪🇸','EUR',5,    0.65,0.55,0.10,0.66),
  ('CL','Chile',   '🇨🇱','CLP',6500, 0.70,0.60,0.30,0.66)
on conflict (code) do nothing;

-- ============================================================
-- 4. PRODUCTOS
-- ============================================================
create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  pais text references public.paises_config(code),
  proveedor text,
  costo_proveedor numeric(14,2),
  stock int default 0,
  link_landing text,
  link_drive text,
  plataforma text check (plataforma in ('TT','FB','TT+FB','Otro')),
  fecha_creacion date default current_date,
  estado text default 'testeo' check (estado in ('testeo','aprendizaje','validado','winner','descartado')),
  responsable_id uuid references public.perfiles(id) on delete set null,
  observacion text,
  created_at timestamptz default now()
);
alter table public.productos enable row level security;
drop policy if exists "productos_all_authenticated" on public.productos;
create policy "productos_all_authenticated" on public.productos for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ============================================================
-- 5. CAMPAÑAS ADS
-- ============================================================
create table if not exists public.campanas_ads (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  campana text not null,
  producto_id uuid references public.productos(id) on delete set null,
  efectividad numeric(5,4) default 0.65,
  flete_devolucion numeric(14,2) default 0,
  n_ventas int default 0,
  ventas_efectivas int generated always as (round(n_ventas * coalesce(efectividad,0))::int) stored,
  precio_venta numeric(14,2) default 0,
  costo_proveedor numeric(14,2) default 0,
  costo_pauta_fb numeric(14,2) default 0,
  costo_pauta_tk numeric(14,2) default 0,
  observacion text,
  created_at timestamptz default now()
);
alter table public.campanas_ads enable row level security;
drop policy if exists "campanas_all_authenticated" on public.campanas_ads;
create policy "campanas_all_authenticated" on public.campanas_ads for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ============================================================
-- 6. PÁGINAS GANADORAS
-- ============================================================
create table if not exists public.paginas_ganadoras (
  id uuid primary key default gen_random_uuid(),
  pais text not null,
  url text not null,
  notas text,
  created_at timestamptz default now()
);
alter table public.paginas_ganadoras enable row level security;
drop policy if exists "paginas_all_authenticated" on public.paginas_ganadoras;
create policy "paginas_all_authenticated" on public.paginas_ganadoras for all using (auth.uid() is not null) with check (auth.uid() is not null);
