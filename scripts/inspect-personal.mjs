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

const { data: perfiles } = await sb.from('perfiles').select('id, nombre, email')
console.log('PERFILES:')
perfiles.forEach(p => console.log(`  ${p.email} (${p.nombre}) — ${p.id}`))

const { data: espacios } = await sb.from('espacios').select('*').order('created_at')
console.log('\nESPACIOS:')
for (const e of espacios) {
  const { data: miembros } = await sb.from('espacio_miembros').select('perfil_id, rol').eq('espacio_id', e.id)
  const { count: catCount } = await sb.from('categorias').select('*', { count: 'exact', head: true }).eq('espacio_id', e.id)
  const { count: txCount } = await sb.from('transacciones').select('*', { count: 'exact', head: true }).eq('espacio_id', e.id)
  console.log(`  [${e.tipo}] "${e.nombre}" (slug=${e.slug})`)
  console.log(`    id: ${e.id}`)
  console.log(`    creado: ${e.created_at}`)
  console.log(`    pin: ${e.pin_hash ? 'sí' : 'no'}`)
  console.log(`    miembros: ${miembros.length}, categorías: ${catCount}, transacciones: ${txCount}`)
}
