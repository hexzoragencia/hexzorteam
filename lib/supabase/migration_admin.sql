-- Hexzor — Onboarding automático + rol superadmin + soporte panel admin
-- Idempotente: se puede correr varias veces sin romper nada.
-- Pegar TODO en Supabase → SQL Editor → Run

-- =====================================================
-- 1. Ampliar valores válidos de rol en perfiles
-- =====================================================
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check
  check (rol in ('socio','admin','operador','usuario','superadmin'));

-- =====================================================
-- 2. Marcar a Victor como superadmin
-- =====================================================
update public.perfiles set rol = 'superadmin' where email = 'hexzoragencia@gmail.com';

-- =====================================================
-- 3. Helper: ¿el usuario actual es superadmin?
-- =====================================================
create or replace function public.es_superadmin() returns bool
language sql security definer stable as $$
  select exists(select 1 from public.perfiles where id = auth.uid() and rol = 'superadmin');
$$;

-- =====================================================
-- 4. Función auxiliar: categorías por defecto para un espacio
-- =====================================================
create or replace function public.seed_categorias_default(esp_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into public.categorias (espacio_id, tipo, nombre, orden) values
    (esp_id, 'ingreso',         'Ingresos por ventas',     1),
    (esp_id, 'ingreso',         'Otros ingresos',          2),
    (esp_id, 'pago_programado', 'Internet y servicios',    1),
    (esp_id, 'suscripcion',     'Suscripciones',           1),
    (esp_id, 'gasto_mensual',   'Alimentación',            1),
    (esp_id, 'gasto_mensual',   'Transporte',              2),
    (esp_id, 'gasto_mensual',   'Salud',                   3),
    (esp_id, 'gasto_mensual',   'Entretenimiento',         4),
    (esp_id, 'ahorro',          'Fondo emergencia',        1)
  on conflict do nothing;
end;
$$;

-- =====================================================
-- 5. Función: crear espacios iniciales (empresarial + personal)
--    Se llama desde el trigger de signup
-- =====================================================
create or replace function public.crear_espacios_iniciales(perfil_id uuid, nombre_usuario text default null)
returns void language plpgsql security definer as $$
declare
  esp_emp uuid;
  esp_per uuid;
  user_name text;
  slug_base text;
begin
  user_name := coalesce(nombre_usuario, (select nombre from public.perfiles where id = perfil_id), 'Usuario');
  slug_base := lower(regexp_replace(unaccent(user_name),'[^a-zA-Z0-9]+','-','g'));
  if length(slug_base) = 0 then slug_base := 'usuario'; end if;

  -- Empresarial (sin PIN)
  insert into public.espacios (slug, nombre, tipo, moneda, created_by)
    values (
      slug_base || '-emp-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6),
      'Empresa · ' || user_name,
      'empresarial', 'COP', perfil_id
    )
    returning id into esp_emp;
  insert into public.espacio_miembros (espacio_id, perfil_id, rol) values (esp_emp, perfil_id, 'owner');
  perform public.seed_categorias_default(esp_emp);

  -- Personal (sin PIN inicialmente — el usuario lo configura después si quiere)
  insert into public.espacios (slug, nombre, tipo, moneda, created_by)
    values (
      slug_base || '-per-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6),
      'Personal · ' || user_name,
      'personal', 'COP', perfil_id
    )
    returning id into esp_per;
  insert into public.espacio_miembros (espacio_id, perfil_id, rol) values (esp_per, perfil_id, 'owner');
  perform public.seed_categorias_default(esp_per);
end;
$$;

-- =====================================================
-- 6. Asegurar extensión unaccent (para el slug)
-- =====================================================
create extension if not exists unaccent;

-- =====================================================
-- 7. Reescribir trigger handle_new_user:
--    crea perfil + espacios iniciales + asigna rol según email
-- =====================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  rol_inicial text;
begin
  rol_inicial := case when new.email = 'hexzoragencia@gmail.com' then 'superadmin' else 'usuario' end;
  insert into public.perfiles (id, nombre, email, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)),
    new.email,
    rol_inicial
  );
  -- Auto-crear espacios empresarial + personal con categorías por defecto
  perform public.crear_espacios_iniciales(new.id, new.raw_user_meta_data->>'nombre');
  return new;
exception when others then
  -- Si algo falla en la creación de espacios, al menos no rompemos el signup
  raise warning 'crear_espacios_iniciales falló para %: %', new.email, sqlerrm;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- =====================================================
-- 8. Política para que los superadmin puedan ver TODOS los perfiles
--    (los usuarios normales solo ven los de espacios compartidos)
-- =====================================================
drop policy if exists "perfiles_select_admin_or_self" on public.perfiles;
drop policy if exists "perfiles_select_all_authenticated" on public.perfiles;
create policy "perfiles_select_admin_or_self" on public.perfiles for select
  using (
    auth.uid() = id
    or public.es_superadmin()
    -- los miembros de un mismo espacio se ven entre sí
    or exists (
      select 1 from public.espacio_miembros m1
      join public.espacio_miembros m2 on m1.espacio_id = m2.espacio_id
      where m1.perfil_id = auth.uid() and m2.perfil_id = perfiles.id
    )
  );

-- =====================================================
-- 9. Vista para el panel admin: stats por usuario
-- =====================================================
create or replace view public.admin_usuarios as
  select
    p.id,
    p.nombre,
    p.email,
    p.rol,
    p.created_at as registrado_at,
    (select count(*) from public.espacio_miembros m where m.perfil_id = p.id) as espacios_count,
    (select count(*) from public.transacciones t
       join public.espacio_miembros m on m.espacio_id = t.espacio_id
       where m.perfil_id = p.id and m.rol = 'owner') as transacciones_count,
    (select max(t.created_at) from public.transacciones t
       join public.espacio_miembros m on m.espacio_id = t.espacio_id
       where m.perfil_id = p.id and m.rol = 'owner') as ultima_actividad
  from public.perfiles p;

grant select on public.admin_usuarios to authenticated;
