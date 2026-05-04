-- Hexzor Empresarial v2 — Espacios + sistema financiero integral
-- Inspirado en el Excel "FINANZAS PERSONALES - VICTOR ROSSO"
-- ===========================================================
-- Pegar TODO en Supabase → SQL Editor → Run
-- Es seguro re-ejecutar.

create extension if not exists pgcrypto;

-- =====================================================
-- LIMPIEZA: la tabla movimientos vieja se reemplaza por transacciones (vinculadas a espacio)
-- =====================================================
drop table if exists public.movimientos cascade;

-- =====================================================
-- 1. ESPACIOS (Empresarial / Personal)
-- =====================================================
create table if not exists public.espacios (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nombre text not null,
  tipo text not null check (tipo in ('empresarial','personal')),
  moneda text not null default 'COP',
  pin_hash text,
  created_by uuid references public.perfiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.espacio_miembros (
  espacio_id uuid references public.espacios(id) on delete cascade,
  perfil_id uuid references public.perfiles(id) on delete cascade,
  rol text not null default 'miembro' check (rol in ('owner','miembro','viewer')),
  created_at timestamptz default now(),
  primary key (espacio_id, perfil_id)
);
create index if not exists idx_em_perfil on public.espacio_miembros(perfil_id);

-- =====================================================
-- 2. CATEGORÍAS (presupuesto items: ingresos, gastos, ahorros, deudas)
-- =====================================================
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  tipo text not null check (tipo in ('ingreso','pago_programado','suscripcion','gasto_mensual','ahorro','deuda')),
  nombre text not null,
  orden int default 0,
  activo bool default true,
  created_at timestamptz default now()
);
create index if not exists idx_cat_esp on public.categorias(espacio_id, tipo);

-- =====================================================
-- 3. PRESUPUESTOS MENSUALES (lo "esperado" por categoría, mes a mes)
-- =====================================================
create table if not exists public.presupuestos_mensuales (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias(id) on delete cascade,
  ano int not null,
  mes int not null check (mes between 1 and 12),
  monto_esperado numeric(14,2) default 0,
  fecha_esperada date,
  unique (categoria_id, ano, mes)
);
create index if not exists idx_pres_periodo on public.presupuestos_mensuales(ano, mes);

-- =====================================================
-- 4. TRANSACCIONES (log diario, "real")
-- =====================================================
create table if not exists public.transacciones (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  categoria_id uuid references public.categorias(id) on delete set null,
  fecha date not null default current_date,
  monto numeric(14,2) not null check (monto >= 0),
  descripcion text,
  responsable_id uuid references public.perfiles(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists idx_tx_esp_fecha on public.transacciones(espacio_id, fecha desc);
create index if not exists idx_tx_cat on public.transacciones(categoria_id);

-- =====================================================
-- 5. FONDOS DE RESERVA (ahorros con metas — "sinking funds")
-- =====================================================
create table if not exists public.fondos_reserva (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  nombre text not null,
  meta numeric(14,2) not null check (meta > 0),
  pago_mensual numeric(14,2) default 0,
  inicial numeric(14,2) default 0,
  ahorrado numeric(14,2) default 0,
  activo bool default true,
  created_at timestamptz default now()
);

-- =====================================================
-- 6. DEUDAS + SNOWBALL CONFIG
-- =====================================================
create table if not exists public.deudas (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  nombre text not null,
  balance numeric(14,2) not null check (balance >= 0),
  interes_anual numeric(8,6) default 0,
  cuota_mensual numeric(14,2) not null check (cuota_mensual >= 0),
  orden int default 0,
  pagada bool default false,
  created_at timestamptz default now()
);

create table if not exists public.snowball_config (
  espacio_id uuid primary key references public.espacios(id) on delete cascade,
  fecha_inicio date default current_date,
  pago_extra_inicial numeric(14,2) default 0,
  pago_extra_mensual numeric(14,2) default 0,
  updated_at timestamptz default now()
);

-- =====================================================
-- HELPER: ¿soy miembro de este espacio?
-- =====================================================
create or replace function public.es_miembro(esp_id uuid) returns bool
language sql security definer stable as $$
  select exists(
    select 1 from public.espacio_miembros
    where espacio_id = esp_id and perfil_id = auth.uid()
  );
$$;

-- =====================================================
-- HELPER: PIN ops para espacios personales
-- =====================================================
create or replace function public.set_pin(esp_id uuid, nuevo_pin text) returns void
language plpgsql security definer as $$
begin
  if not public.es_miembro(esp_id) then
    raise exception 'No eres miembro de este espacio';
  end if;
  update public.espacios
    set pin_hash = crypt(nuevo_pin, gen_salt('bf', 8))
    where id = esp_id and tipo = 'personal';
end;
$$;

create or replace function public.verificar_pin(esp_id uuid, pin_intento text) returns bool
language plpgsql security definer as $$
declare h text;
begin
  if not public.es_miembro(esp_id) then return false; end if;
  select pin_hash into h from public.espacios where id = esp_id and tipo = 'personal';
  if h is null then return false; end if;
  return crypt(pin_intento, h) = h;
end;
$$;

-- =====================================================
-- RLS
-- =====================================================
alter table public.espacios enable row level security;
alter table public.espacio_miembros enable row level security;
alter table public.categorias enable row level security;
alter table public.presupuestos_mensuales enable row level security;
alter table public.transacciones enable row level security;
alter table public.fondos_reserva enable row level security;
alter table public.deudas enable row level security;
alter table public.snowball_config enable row level security;

-- ESPACIOS
drop policy if exists "esp_select_member" on public.espacios;
drop policy if exists "esp_insert_self" on public.espacios;
drop policy if exists "esp_insert_authed" on public.espacios;
drop policy if exists "esp_update_owner" on public.espacios;
drop policy if exists "esp_delete_owner" on public.espacios;
create policy "esp_select_member" on public.espacios for select
  using (auth.uid() is not null and (
    id in (select espacio_id from public.espacio_miembros where perfil_id = auth.uid())
  ));
create policy "esp_insert_authed" on public.espacios for insert
  with check (auth.uid() is not null);
create policy "esp_update_owner" on public.espacios for update
  using (id in (select espacio_id from public.espacio_miembros where perfil_id = auth.uid() and rol = 'owner'));
create policy "esp_delete_owner" on public.espacios for delete
  using (id in (select espacio_id from public.espacio_miembros where perfil_id = auth.uid() and rol = 'owner'));

-- ESPACIO_MIEMBROS
drop policy if exists "em_select_self_or_member" on public.espacio_miembros;
drop policy if exists "em_insert_owner_or_self" on public.espacio_miembros;
drop policy if exists "em_delete_owner_or_self" on public.espacio_miembros;
create policy "em_select_self_or_member" on public.espacio_miembros for select
  using (
    perfil_id = auth.uid() or
    public.es_miembro(espacio_id)
  );
-- Insert: el owner del espacio puede agregar, o el creator del espacio se agrega a sí mismo
create policy "em_insert_owner_or_self" on public.espacio_miembros for insert
  with check (
    perfil_id = auth.uid() or
    espacio_id in (select espacio_id from public.espacio_miembros where perfil_id = auth.uid() and rol = 'owner')
  );
create policy "em_delete_owner_or_self" on public.espacio_miembros for delete
  using (
    perfil_id = auth.uid() or
    espacio_id in (select espacio_id from public.espacio_miembros where perfil_id = auth.uid() and rol = 'owner')
  );

-- CATEGORÍAS
drop policy if exists "cat_member_all" on public.categorias;
create policy "cat_member_all" on public.categorias for all
  using (public.es_miembro(espacio_id))
  with check (public.es_miembro(espacio_id));

-- PRESUPUESTOS (depende de la categoría)
drop policy if exists "pres_member_all" on public.presupuestos_mensuales;
create policy "pres_member_all" on public.presupuestos_mensuales for all
  using (public.es_miembro((select espacio_id from public.categorias where id = categoria_id)))
  with check (public.es_miembro((select espacio_id from public.categorias where id = categoria_id)));

-- TRANSACCIONES
drop policy if exists "tx_member_all" on public.transacciones;
create policy "tx_member_all" on public.transacciones for all
  using (public.es_miembro(espacio_id))
  with check (public.es_miembro(espacio_id));

-- FONDOS
drop policy if exists "fondos_member_all" on public.fondos_reserva;
create policy "fondos_member_all" on public.fondos_reserva for all
  using (public.es_miembro(espacio_id))
  with check (public.es_miembro(espacio_id));

-- DEUDAS
drop policy if exists "deudas_member_all" on public.deudas;
create policy "deudas_member_all" on public.deudas for all
  using (public.es_miembro(espacio_id))
  with check (public.es_miembro(espacio_id));

-- SNOWBALL
drop policy if exists "snow_member_all" on public.snowball_config;
create policy "snow_member_all" on public.snowball_config for all
  using (public.es_miembro(espacio_id))
  with check (public.es_miembro(espacio_id));

-- =====================================================
-- BACKFILL: crear el espacio "Vasecom" empresarial compartido
--           y agregar a todos los perfiles existentes
-- =====================================================
do $$
declare
  vasecom_id uuid;
  primer_perfil uuid;
  p record;
begin
  select id into vasecom_id from public.espacios where slug = 'vasecom' limit 1;
  if vasecom_id is null then
    select id into primer_perfil from public.perfiles order by created_at limit 1;
    if primer_perfil is not null then
      insert into public.espacios (slug, nombre, tipo, moneda, created_by)
      values ('vasecom', 'Vasecom', 'empresarial', 'COP', primer_perfil)
      returning id into vasecom_id;
    end if;
  end if;

  if vasecom_id is not null then
    for p in select id from public.perfiles loop
      insert into public.espacio_miembros (espacio_id, perfil_id, rol)
      values (vasecom_id, p.id, 'owner')
      on conflict do nothing;
    end loop;
  end if;
end $$;

-- =====================================================
-- TRIGGER: nuevo perfil → agregar automáticamente al espacio Vasecom
-- =====================================================
create or replace function public.handle_new_perfil_espacios() returns trigger
language plpgsql security definer as $$
declare vasecom_id uuid;
begin
  select id into vasecom_id from public.espacios where slug = 'vasecom' limit 1;
  if vasecom_id is null then
    insert into public.espacios (slug, nombre, tipo, moneda, created_by)
    values ('vasecom', 'Vasecom', 'empresarial', 'COP', new.id)
    returning id into vasecom_id;
  end if;
  insert into public.espacio_miembros (espacio_id, perfil_id, rol)
  values (vasecom_id, new.id, 'miembro')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_perfil_create_espacios on public.perfiles;
create trigger on_perfil_create_espacios after insert on public.perfiles
  for each row execute function public.handle_new_perfil_espacios();
