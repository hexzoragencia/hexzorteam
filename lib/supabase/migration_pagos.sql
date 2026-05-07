-- Hexzor — Pagos programados (recurrentes con fecha y notificación)
-- Idempotente. Pegar TODO en Supabase → SQL Editor → Run.

-- ============================================================
-- 1. Tabla de pagos programados (recurrentes)
-- ============================================================
create table if not exists public.pagos_programados (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  nombre text not null,
  monto numeric(14,2) not null check (monto >= 0),
  dia_pago int not null check (dia_pago between 1 and 31),
  categoria_id uuid references public.categorias(id) on delete set null,
  recurrencia text not null default 'mensual' check (recurrencia in ('mensual','semanal','anual','unico')),
  activo bool default true,
  notas text,
  created_by uuid references public.perfiles(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_pagos_prog_espacio on public.pagos_programados(espacio_id);
create index if not exists idx_pagos_prog_dia on public.pagos_programados(dia_pago);

alter table public.pagos_programados enable row level security;
drop policy if exists "pagos_prog_miembro" on public.pagos_programados;
create policy "pagos_prog_miembro" on public.pagos_programados for all
  using (public.es_miembro(espacio_id))
  with check (public.es_miembro(espacio_id));

-- ============================================================
-- 2. Tabla de pagos realizados (tracking de qué pagos se hicieron en qué fecha)
-- ============================================================
create table if not exists public.pagos_realizados (
  id uuid primary key default gen_random_uuid(),
  pago_id uuid references public.pagos_programados(id) on delete cascade,
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  fecha_pago date not null default current_date,
  monto_pagado numeric(14,2) not null,
  transaccion_id uuid references public.transacciones(id) on delete set null,
  notas text,
  created_at timestamptz default now()
);
create index if not exists idx_pagos_real_espacio on public.pagos_realizados(espacio_id, fecha_pago desc);
create index if not exists idx_pagos_real_pago on public.pagos_realizados(pago_id);

alter table public.pagos_realizados enable row level security;
drop policy if exists "pagos_real_miembro" on public.pagos_realizados;
create policy "pagos_real_miembro" on public.pagos_realizados for all
  using (public.es_miembro(espacio_id))
  with check (public.es_miembro(espacio_id));

-- ============================================================
-- 3. Vista: pagos del mes actual con su estado (pagado / pendiente / vencido)
-- ============================================================
create or replace view public.pagos_del_mes as
  with mes_actual as (
    select
      extract(year from current_date)::int as ano,
      extract(month from current_date)::int as mes
  )
  select
    p.id, p.espacio_id, p.nombre, p.monto, p.dia_pago, p.recurrencia,
    p.categoria_id, p.activo, p.notas,
    -- Calcular fecha de vencimiento del mes en curso (clamping a fin de mes)
    make_date(
      ma.ano, ma.mes,
      least(p.dia_pago, extract(day from (date_trunc('month', current_date) + interval '1 month - 1 day')::date)::int)
    ) as fecha_vencimiento,
    -- Si tiene un pago_realizado en este mes
    pr.id as pago_realizado_id,
    pr.fecha_pago,
    pr.monto_pagado,
    case
      when pr.id is not null then 'pagado'
      when make_date(ma.ano, ma.mes, least(p.dia_pago, extract(day from (date_trunc('month', current_date) + interval '1 month - 1 day')::date)::int)) < current_date then 'vencido'
      when (make_date(ma.ano, ma.mes, least(p.dia_pago, extract(day from (date_trunc('month', current_date) + interval '1 month - 1 day')::date)::int)) - current_date) <= 2 then 'proximo'
      else 'pendiente'
    end as estado
  from public.pagos_programados p
  cross join mes_actual ma
  left join public.pagos_realizados pr
    on pr.pago_id = p.id
    and extract(year from pr.fecha_pago) = ma.ano
    and extract(month from pr.fecha_pago) = ma.mes
  where p.activo = true;

grant select on public.pagos_del_mes to authenticated;

-- ============================================================
-- 4. Trigger updated_at
-- ============================================================
drop trigger if exists trg_pagos_prog_updated on public.pagos_programados;
create trigger trg_pagos_prog_updated before update on public.pagos_programados
  for each row execute function public.set_emp_updated_at();
