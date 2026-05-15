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
--    Si el pago se creó DESPUÉS del día de pago del mes actual,
--    se considera que el primer ciclo es el mes siguiente (no aparece como vencido).
-- ============================================================
create or replace view public.pagos_del_mes as
  with calc as (
    select
      p.*,
      current_date as today,
      -- Día efectivo de este mes (clamping a último día si dia_pago > días del mes)
      make_date(
        extract(year from current_date)::int,
        extract(month from current_date)::int,
        least(p.dia_pago, extract(day from (date_trunc('month', current_date) + interval '1 month - 1 day')::date)::int)
      ) as fecha_mes_actual,
      -- Día efectivo del mes siguiente
      (date_trunc('month', current_date) + interval '1 month'
        + (least(p.dia_pago, extract(day from (date_trunc('month', current_date) + interval '2 month - 1 day')::date)::int) - 1) * interval '1 day'
      )::date as fecha_mes_siguiente
    from public.pagos_programados p
    where p.activo = true
  ),
  resolved as (
    select
      c.*,
      -- Si la fecha de este mes ya pasó Y el pago se creó después → usar mes siguiente
      case
        when c.fecha_mes_actual < c.today AND c.created_at::date > c.fecha_mes_actual
          then c.fecha_mes_siguiente
        else c.fecha_mes_actual
      end as fecha_vencimiento
    from calc c
  )
  select
    r.id, r.espacio_id, r.nombre, r.monto, r.dia_pago, r.recurrencia,
    r.categoria_id, r.activo, r.notas,
    r.fecha_vencimiento,
    pr.id as pago_realizado_id,
    pr.fecha_pago,
    pr.monto_pagado,
    case
      when pr.id is not null then 'pagado'
      when r.fecha_vencimiento < r.today then 'vencido'
      when (r.fecha_vencimiento - r.today) <= 2 then 'proximo'
      else 'pendiente'
    end as estado
  from resolved r
  left join public.pagos_realizados pr
    on pr.pago_id = r.id
    and extract(year from pr.fecha_pago) = extract(year from r.fecha_vencimiento)
    and extract(month from pr.fecha_pago) = extract(month from r.fecha_vencimiento);

grant select on public.pagos_del_mes to authenticated;

-- ============================================================
-- 4. Trigger updated_at
-- ============================================================
drop trigger if exists trg_pagos_prog_updated on public.pagos_programados;
create trigger trg_pagos_prog_updated before update on public.pagos_programados
  for each row execute function public.set_emp_updated_at();

-- ============================================================
-- 5. Trigger AUTO-MATCH: cuando se inserta una transacción,
--    intenta vincularla con un pago programado del mismo mes
--    si la descripción contiene el nombre del pago.
--    Ejemplo: pago programado "Casa" + transacción "renta de casa 2,100,000"
--             → automáticamente se chulea Casa este mes.
-- ============================================================
create or replace function public.auto_match_transaccion_pago()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pago_id uuid;
  v_mes int := extract(month from NEW.fecha)::int;
  v_ano int := extract(year from NEW.fecha)::int;
begin
  -- Si la descripción está vacía, no se puede hacer match
  if NEW.descripcion is null or length(trim(NEW.descripcion)) = 0 then
    return NEW;
  end if;

  -- Si la descripción empieza con "Pago:" significa que viene del botón "Pagar"
  -- y ya se está creando manualmente el pago_realizado en el código, no duplicar
  if lower(NEW.descripcion) like 'pago:%' then
    return NEW;
  end if;

  -- Buscar pago programado activo del espacio cuyo nombre aparezca en la descripción
  -- y que NO esté ya pagado este mes. Prefiere matches más específicos (nombre largo).
  select pp.id into v_pago_id
  from public.pagos_programados pp
  where pp.espacio_id = NEW.espacio_id
    and pp.activo = true
    and length(pp.nombre) >= 3
    and lower(NEW.descripcion) like '%' || lower(pp.nombre) || '%'
    and not exists (
      select 1 from public.pagos_realizados pr
      where pr.pago_id = pp.id
        and extract(month from pr.fecha_pago) = v_mes
        and extract(year from pr.fecha_pago) = v_ano
    )
  order by length(pp.nombre) desc
  limit 1;

  if v_pago_id is not null then
    insert into public.pagos_realizados (pago_id, espacio_id, fecha_pago, monto_pagado, transaccion_id)
    values (v_pago_id, NEW.espacio_id, NEW.fecha, NEW.monto, NEW.id);
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_auto_match_pago on public.transacciones;
create trigger trg_auto_match_pago
  after insert on public.transacciones
  for each row
  execute function public.auto_match_transaccion_pago();
