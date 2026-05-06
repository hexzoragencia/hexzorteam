-- Hexzor — Mejoras 6-en-1 (alias por espacio + horas hábitos + apariencia por espacio)
-- Idempotente. Pegar TODO en Supabase → SQL Editor → Run.

-- ============================================================
-- 1. Alias por espacio (cómo quiere que el coach lo llame)
-- ============================================================
alter table public.espacio_miembros add column if not exists alias text;

-- ============================================================
-- 5. Hábitos con rango de horas
-- ============================================================
alter table public.habitos add column if not exists hora_desde time;
alter table public.habitos add column if not exists hora_hasta time;

-- ============================================================
-- 7. Apariencia por espacio (no global)
-- Nueva tabla con (perfil_id, espacio_id) como PK.
-- Si un usuario no tiene fila para un espacio, se usan los defaults.
-- ============================================================
create table if not exists public.preferencias_espacio (
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  espacio_id uuid not null references public.espacios(id) on delete cascade,
  tema text not null default 'azul' check (tema in ('azul','verde','morado','rosa','naranja','cyan','negro','marron')),
  fuente text not null default 'Inter' check (fuente in ('Inter','Poppins','Roboto','Montserrat','Open Sans','Lato','Nunito','Plus Jakarta Sans','Outfit','Playfair Display')),
  modo text not null default 'auto' check (modo in ('claro','oscuro','auto')),
  densidad text not null default 'normal' check (densidad in ('compacta','normal','espaciada')),
  updated_at timestamptz default now(),
  primary key (perfil_id, espacio_id)
);

alter table public.preferencias_espacio enable row level security;
drop policy if exists "prefs_esp_select_own" on public.preferencias_espacio;
drop policy if exists "prefs_esp_insert_own" on public.preferencias_espacio;
drop policy if exists "prefs_esp_update_own" on public.preferencias_espacio;
drop policy if exists "prefs_esp_delete_own" on public.preferencias_espacio;
create policy "prefs_esp_select_own" on public.preferencias_espacio for select using (perfil_id = (select auth.uid()));
create policy "prefs_esp_insert_own" on public.preferencias_espacio for insert with check (perfil_id = (select auth.uid()));
create policy "prefs_esp_update_own" on public.preferencias_espacio for update using (perfil_id = (select auth.uid()));
create policy "prefs_esp_delete_own" on public.preferencias_espacio for delete using (perfil_id = (select auth.uid()));
