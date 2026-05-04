import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(Boolean)
    .map(l => l.split('='))
    .map(([k, ...rest]) => [k.trim(), rest.join('=').trim()])
)

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// Crear una RPC ad-hoc usando una función SQL
const sql = `
  select
    n.nspname as schema,
    c.relname as table,
    t.tgname as trigger_name,
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_def
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  join pg_proc p on p.oid = t.tgfoid
  where not t.tgisinternal
    and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname = 'users'))
  order by n.nspname, c.relname, t.tgname;
`

// Ejecutar via RPC personalizada — primero necesitamos crearla
const createDiagFn = `
  create or replace function public.diag_triggers() returns table(
    schema_name text, table_name text, trigger_name text, function_name text, function_def text
  ) language sql security definer as $$
    select n.nspname::text, c.relname::text, t.tgname::text, p.proname::text, pg_get_functiondef(p.oid)::text
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    where not t.tgisinternal
      and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname = 'users'))
    order by n.nspname, c.relname, t.tgname;
  $$;
`

// PostgREST no permite DDL via RPC normalmente. Vamos a usar el endpoint pg-meta de Supabase.
// Alternativa: usar la API REST con el service role key contra pg_catalog
const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/diag_triggers`
const headers = {
  'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

const r = await fetch(url, { method: 'POST', headers, body: '{}' })
const data = await r.json()
if (!r.ok) {
  console.log('La función diag_triggers no existe todavía. Mostrando función handle_new_user actual via consulta directa...')
  console.log('Status:', r.status, data)
} else {
  data.forEach(t => {
    console.log(`\n=== ${t.schema_name}.${t.table_name} → ${t.trigger_name} (fn: ${t.function_name})`)
    console.log(t.function_def)
  })
}
