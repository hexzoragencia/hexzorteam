-- =============================================================
-- migration_categorias_otros.sql
-- Helper: devuelve el id de "Otros ingresos" o "Otros gastos"
-- (creando la categoría si no existe). Usado por el form rápido
-- de Transacciones para que el usuario pueda registrar sin
-- tener que elegir categoría.
--
-- Idempotente.
-- =============================================================

create or replace function public.get_or_create_categoria_otros(
  p_espacio_id uuid,
  p_tipo text  -- 'ingreso' o 'gasto_mensual'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nombre text;
  v_max_orden int;
begin
  -- Validar tipo
  if p_tipo not in ('ingreso','gasto_mensual','suscripcion','pago_programado','ahorro','deuda') then
    raise exception 'Tipo de categoría inválido: %', p_tipo;
  end if;

  -- Validar acceso (solo miembros del espacio)
  if not exists (
    select 1 from public.espacio_miembros
    where espacio_id = p_espacio_id
      and perfil_id = (select auth.uid())
  ) then
    raise exception 'No tienes acceso a este espacio';
  end if;

  -- Determinar nombre según tipo
  v_nombre := case p_tipo
    when 'ingreso' then 'Otros ingresos'
    when 'gasto_mensual' then 'Otros gastos'
    else 'Otros'
  end;

  -- ¿Ya existe?
  select id into v_id
  from public.categorias
  where espacio_id = p_espacio_id
    and tipo = p_tipo
    and lower(nombre) = lower(v_nombre)
    and activo = true
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  -- Crear nueva
  select coalesce(max(orden), 0) + 1 into v_max_orden
  from public.categorias
  where espacio_id = p_espacio_id;

  insert into public.categorias (espacio_id, nombre, tipo, orden, activo)
  values (p_espacio_id, v_nombre, p_tipo, v_max_orden, true)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.get_or_create_categoria_otros(uuid, text) to authenticated;
