-- Hexzor — Workflow de aprobación de cuentas
-- Idempotente. Pegar TODO en Supabase → SQL Editor → Run.

-- ============================================================
-- 1. Campo estado en perfiles
-- ============================================================
alter table public.perfiles add column if not exists estado text;
update public.perfiles set estado = 'activo' where estado is null;
alter table public.perfiles alter column estado set not null;
alter table public.perfiles alter column estado set default 'pendiente';
alter table public.perfiles drop constraint if exists perfiles_estado_check;
alter table public.perfiles add constraint perfiles_estado_check
  check (estado in ('pendiente','activo','rechazado'));

-- ============================================================
-- 2. Aprobar usuario (solo superadmin) — cambia estado y crea espacios si no tiene
-- ============================================================
create or replace function public.aprobar_usuario(target_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  user_nombre text;
  ya_tiene_owner bool;
begin
  if not public.es_superadmin() then
    raise exception 'Solo superadmin puede aprobar usuarios';
  end if;

  update public.perfiles set estado = 'activo' where id = target_id;

  select nombre into user_nombre from public.perfiles where id = target_id;
  select exists (
    select 1 from public.espacio_miembros m
    where m.perfil_id = target_id and m.rol = 'owner'
  ) into ya_tiene_owner;

  if not ya_tiene_owner then
    perform public.crear_espacios_iniciales(target_id, user_nombre);
  end if;
end;
$$;

-- ============================================================
-- 3. Rechazar usuario (solo superadmin)
-- ============================================================
create or replace function public.rechazar_usuario(target_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if not public.es_superadmin() then
    raise exception 'Solo superadmin puede rechazar usuarios';
  end if;
  update public.perfiles set estado = 'rechazado' where id = target_id;
end;
$$;

-- ============================================================
-- 4. Trigger: nuevos usuarios quedan PENDIENTES por defecto.
--    Solo el superadmin (Victor) queda activo automáticamente.
--    Los espacios solo se crean al aprobar.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  rol_inicial text;
  estado_inicial text;
begin
  if new.email = 'hexzoragencia@gmail.com' then
    rol_inicial := 'superadmin';
    estado_inicial := 'activo';
  else
    rol_inicial := 'usuario';
    estado_inicial := 'pendiente';
  end if;

  insert into public.perfiles (id, nombre, email, rol, estado)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email,'@',1)),
    new.email,
    rol_inicial,
    estado_inicial
  );

  -- Solo crea espacios si la cuenta queda activa de entrada (superadmin)
  if estado_inicial = 'activo' then
    begin
      perform public.crear_espacios_iniciales(new.id, new.raw_user_meta_data->>'nombre');
    exception when others then
      insert into public.trigger_debug_log (fn, email, error)
        values ('crear_espacios_iniciales', new.email, sqlerrm);
    end;
  end if;

  return new;
exception when others then
  insert into public.trigger_debug_log (fn, email, error)
    values ('handle_new_user', new.email, sqlerrm);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 5. Actualizar vista admin_usuarios con campo estado
-- ============================================================
create or replace view public.admin_usuarios as
  select
    p.id, p.nombre, p.email, p.rol, p.estado,
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
