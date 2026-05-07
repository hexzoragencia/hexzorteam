-- Hexzor — Fase 1 de mejoras: hábitos ↔ planeación
-- Idempotente. Pegar TODO en Supabase → SQL Editor → Run.

-- ============================================================
-- 1. Agregar habito_id a tareas (para sincronizar hábitos ↔ planeación)
-- Cuando marcas una tarea como hecha, si tiene habito_id, también marca
-- el hábito como cumplido en su fecha. Y viceversa.
-- ============================================================
alter table public.tareas add column if not exists habito_id uuid references public.habitos(id) on delete set null;
create index if not exists idx_tareas_habito on public.tareas(habito_id) where habito_id is not null;

-- ============================================================
-- 2. Auto-sincronización: cuando se completa una tarea con habito_id,
--    se inserta una marca en habito_marcas.
--    Y al revés: cuando se inserta una marca, se completan las tareas
--    de ese hábito en esa fecha.
-- ============================================================
create or replace function public.sync_tarea_habito() returns trigger
language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  -- INSERT: si la tarea entra ya completada con habito_id, sincronizar
  if (tg_op = 'INSERT' and new.completada and new.habito_id is not null) then
    insert into public.habito_marcas (habito_id, fecha)
      values (new.habito_id, new.fecha)
      on conflict do nothing;
  end if;
  -- UPDATE: si cambió a completada=true, sincronizar
  if (tg_op = 'UPDATE' and new.completada and not coalesce(old.completada, false) and new.habito_id is not null) then
    insert into public.habito_marcas (habito_id, fecha)
      values (new.habito_id, new.fecha)
      on conflict do nothing;
  end if;
  -- UPDATE: si cambió a completada=false, eliminar la marca
  if (tg_op = 'UPDATE' and not new.completada and old.completada and new.habito_id is not null) then
    delete from public.habito_marcas
      where habito_id = new.habito_id and fecha = new.fecha;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_tarea_habito on public.tareas;
create trigger trg_sync_tarea_habito
  after insert or update of completada on public.tareas
  for each row execute function public.sync_tarea_habito();

-- Y el reverso: marcar/desmarcar habito_marcas → completar tareas del día
create or replace function public.sync_habito_tarea() returns trigger
language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if (tg_op = 'INSERT') then
    -- Al marcar el hábito en una fecha, completar todas las tareas vinculadas a ese hábito en esa fecha
    update public.tareas
      set completada = true, completada_at = now()
      where habito_id = new.habito_id
        and fecha = new.fecha
        and completada = false;
  elsif (tg_op = 'DELETE') then
    update public.tareas
      set completada = false, completada_at = null
      where habito_id = old.habito_id
        and fecha = old.fecha
        and completada = true;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_habito_tarea on public.habito_marcas;
create trigger trg_sync_habito_tarea
  after insert or delete on public.habito_marcas
  for each row execute function public.sync_habito_tarea();
