-- Hexzor — Ola 1 de operación empresarial: Productos, Campañas ADS, Proyección
-- Idempotente. Pegar TODO en Supabase → SQL Editor → Run.

-- ============================================================
-- 1. PRODUCTOS — catálogo del negocio
-- ============================================================
create table if not exists public.emp_productos (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  created_by uuid references public.perfiles(id) on delete set null,
  nombre text not null,
  proveedor text,
  pais text check (pais in ('CO','MX','EC','ES','CL','PE','GT','USA','OTRO')),
  responsable_id uuid references public.perfiles(id) on delete set null,
  costo_proveedor numeric(14,2),
  precio_final numeric(14,2),
  precio_2und numeric(14,2),
  precio_x3 numeric(14,2),
  stock int default 0,
  link_landing text,
  link_drive text,
  link_creativos text,
  plataforma text check (plataforma in ('TT','FB','TT+FB','Otro')),
  tipo text default 'dropshipping' check (tipo in ('dropshipping','importacion','local','otro')),
  estado text not null default 'testeo' check (estado in ('testeo','aprendizaje','validado','winner','descartado','apagado')),
  fecha_activacion_tt date,
  fecha_activacion_fb date,
  observacion text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_emp_prod_espacio on public.emp_productos(espacio_id);
create index if not exists idx_emp_prod_estado on public.emp_productos(estado);

alter table public.emp_productos enable row level security;
drop policy if exists "emp_productos_miembro" on public.emp_productos;
create policy "emp_productos_miembro" on public.emp_productos for all
  using (public.es_miembro(espacio_id))
  with check (public.es_miembro(espacio_id));

-- ============================================================
-- 2. CAMPAÑAS ADS — registro diario por campaña/producto
-- ============================================================
create table if not exists public.emp_campanas (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  producto_id uuid references public.emp_productos(id) on delete set null,
  created_by uuid references public.perfiles(id) on delete set null,
  fecha date not null default current_date,
  nombre_campana text default 'Testeo',
  efectividad_pct numeric(5,4) default 0.65,
  flete_devolucion numeric(14,2) default 0,
  num_ventas int default 0,
  precio_venta numeric(14,2),
  costo_proveedor numeric(14,2),
  costo_pauta_fb numeric(14,2) default 0,
  costo_pauta_tk numeric(14,2) default 0,
  observacion text,
  created_at timestamptz default now()
);
create index if not exists idx_emp_camp_espacio on public.emp_campanas(espacio_id);
create index if not exists idx_emp_camp_fecha on public.emp_campanas(espacio_id, fecha desc);
create index if not exists idx_emp_camp_prod on public.emp_campanas(producto_id);

alter table public.emp_campanas enable row level security;
drop policy if exists "emp_campanas_miembro" on public.emp_campanas;
create policy "emp_campanas_miembro" on public.emp_campanas for all
  using (public.es_miembro(espacio_id))
  with check (public.es_miembro(espacio_id));

-- Vista con métricas calculadas
create or replace view public.emp_campanas_calc as
  select
    c.*,
    p.nombre as producto_nombre,
    (c.num_ventas * coalesce(c.efectividad_pct, 0))::numeric(14,4) as ventas_efectivas,
    (coalesce(c.costo_pauta_fb, 0) + coalesce(c.costo_pauta_tk, 0))::numeric(14,2) as total_publicidad,
    case when c.num_ventas > 0
      then ((coalesce(c.costo_pauta_fb,0) + coalesce(c.costo_pauta_tk,0)) / c.num_ventas)::numeric(14,2)
      else 0 end as cpa,
    case when coalesce(c.precio_venta,0) > 0 and coalesce(c.costo_proveedor,0) >= 0
      then (c.precio_venta - c.costo_proveedor - coalesce(c.flete_devolucion, 0))::numeric(14,2)
      else 0 end as utilidad_x_producto_breakeven,
    case
      when c.num_ventas > 0 and coalesce(c.precio_venta,0) > 0
      then (
        (c.precio_venta - coalesce(c.costo_proveedor,0) - coalesce(c.flete_devolucion,0))
        - ((coalesce(c.costo_pauta_fb,0) + coalesce(c.costo_pauta_tk,0)) / c.num_ventas)
      )::numeric(14,2)
      else 0 end as utilidad_x_producto,
    case
      when c.num_ventas > 0 and coalesce(c.precio_venta,0) > 0
      then (
        ((c.precio_venta - coalesce(c.costo_proveedor,0) - coalesce(c.flete_devolucion,0))
        - ((coalesce(c.costo_pauta_fb,0) + coalesce(c.costo_pauta_tk,0)) / c.num_ventas))
        * (c.num_ventas * coalesce(c.efectividad_pct,0))
      )::numeric(14,2)
      else 0 end as utilidad_neta,
    case
      when (coalesce(c.costo_pauta_fb,0) + coalesce(c.costo_pauta_tk,0)) > 0 and c.num_ventas > 0
      then (
        (((c.precio_venta - coalesce(c.costo_proveedor,0) - coalesce(c.flete_devolucion,0))
          - ((coalesce(c.costo_pauta_fb,0) + coalesce(c.costo_pauta_tk,0)) / c.num_ventas))
         * (c.num_ventas * coalesce(c.efectividad_pct,0)))
        / (coalesce(c.costo_pauta_fb,0) + coalesce(c.costo_pauta_tk,0))
      )::numeric(8,4)
      else 0 end as roi
  from public.emp_campanas c
  left join public.emp_productos p on p.id = c.producto_id;

grant select on public.emp_campanas_calc to authenticated;

-- ============================================================
-- 3. PROYECCIÓN & METAS — config + tracking diario
-- ============================================================
create table if not exists public.emp_metas (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id) on delete cascade unique,
  -- Cálculo "ventas iniciales" (parte 1 del Excel)
  meta_ventas_iniciales int default 500,
  pct_confirmacion numeric(5,4) default 0.80,
  pct_entrega numeric(5,4) default 0.80,
  meta_gastos_fijos numeric(14,2) default 0,
  meta_ganancia numeric(14,2) default 0,
  -- Metas operativas
  meta_ventas_diarias int default 53,
  meta_ventas_semanales int default 371,
  meta_ventas_mensuales int default 1590,
  -- Productos en testeo / mes
  meta_productos_testeo_mes int default 25,
  observacion text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.emp_metas enable row level security;
drop policy if exists "emp_metas_miembro" on public.emp_metas;
create policy "emp_metas_miembro" on public.emp_metas for all
  using (public.es_miembro(espacio_id))
  with check (public.es_miembro(espacio_id));

-- Tracking diario: ventas y productos montados
create table if not exists public.emp_metas_tracking (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  fecha date not null default current_date,
  ventas_dia int default 0,
  productos_montados int default 0,
  observacion text,
  created_at timestamptz default now(),
  unique (espacio_id, fecha)
);
create index if not exists idx_emp_meta_track_fecha on public.emp_metas_tracking(espacio_id, fecha desc);

alter table public.emp_metas_tracking enable row level security;
drop policy if exists "emp_metas_track_miembro" on public.emp_metas_tracking;
create policy "emp_metas_track_miembro" on public.emp_metas_tracking for all
  using (public.es_miembro(espacio_id))
  with check (public.es_miembro(espacio_id));

-- ============================================================
-- 4. Triggers updated_at
-- ============================================================
create or replace function public.set_emp_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_emp_prod_updated on public.emp_productos;
create trigger trg_emp_prod_updated before update on public.emp_productos
  for each row execute function public.set_emp_updated_at();

drop trigger if exists trg_emp_metas_updated on public.emp_metas;
create trigger trg_emp_metas_updated before update on public.emp_metas
  for each row execute function public.set_emp_updated_at();
