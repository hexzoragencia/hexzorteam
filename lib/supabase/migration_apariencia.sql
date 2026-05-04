-- Hexzor — Personalización de apariencia (tema, fuente, modo, densidad)
-- Pegar en Supabase → SQL Editor → Run. Es seguro re-ejecutar.

create table if not exists public.preferencias_usuario (
  perfil_id uuid primary key references public.perfiles(id) on delete cascade,
  tema text not null default 'azul' check (tema in ('azul','verde','morado','rosa','naranja','cyan','negro','marron')),
  fuente text not null default 'Inter' check (fuente in ('Inter','Poppins','Roboto','Montserrat','Open Sans','Lato','Nunito','Plus Jakarta Sans','Outfit','Playfair Display')),
  modo text not null default 'auto' check (modo in ('claro','oscuro','auto')),
  densidad text not null default 'normal' check (densidad in ('compacta','normal','espaciada')),
  updated_at timestamptz default now()
);

alter table public.preferencias_usuario enable row level security;

drop policy if exists "prefs_select_own" on public.preferencias_usuario;
drop policy if exists "prefs_upsert_own" on public.preferencias_usuario;
drop policy if exists "prefs_update_own" on public.preferencias_usuario;
drop policy if exists "prefs_insert_own" on public.preferencias_usuario;

create policy "prefs_select_own" on public.preferencias_usuario for select using (perfil_id = auth.uid());
create policy "prefs_insert_own" on public.preferencias_usuario for insert with check (perfil_id = auth.uid());
create policy "prefs_update_own" on public.preferencias_usuario for update using (perfil_id = auth.uid());

-- Trigger: nuevos perfiles obtienen una fila default
create or replace function public.handle_new_perfil_prefs() returns trigger
language plpgsql security definer as $$
begin
  insert into public.preferencias_usuario (perfil_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_perfil_create_prefs on public.perfiles;
create trigger on_perfil_create_prefs after insert on public.perfiles
  for each row execute function public.handle_new_perfil_prefs();

-- Backfill: crear filas para perfiles existentes
insert into public.preferencias_usuario (perfil_id)
select id from public.perfiles where id not in (select perfil_id from public.preferencias_usuario)
on conflict do nothing;
