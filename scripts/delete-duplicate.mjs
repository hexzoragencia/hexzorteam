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

const TARGET = '2ae01639-c9a3-40c5-980f-6bf4950789d0'

const { data: pre } = await sb.from('espacios').select('id, nombre, slug').eq('id', TARGET).single()
console.log('A eliminar:', pre)

const { error } = await sb.from('espacios').delete().eq('id', TARGET)
if (error) { console.error('ERROR:', error); process.exit(1) }
console.log('✅ Eliminado')

const { data: rest } = await sb.from('espacios').select('nombre, tipo, slug').order('created_at')
console.log('\nEspacios restantes:')
rest.forEach(e => console.log(`  [${e.tipo}] "${e.nombre}" (${e.slug})`))
