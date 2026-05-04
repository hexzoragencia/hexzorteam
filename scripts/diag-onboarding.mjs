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

console.log('=================================================')
console.log('1) USUARIOS EN auth.users (ordenados por más reciente)')
console.log('=================================================')
const { data: authUsers, error: e1 } = await sb.auth.admin.listUsers({ perPage: 50 })
if (e1) console.log('ERROR:', e1.message)
else {
  authUsers.users
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .forEach(u => {
      const conf = u.email_confirmed_at ? '✅ confirmado' : '⚠️  SIN confirmar'
      console.log(`  ${u.email}  |  creado: ${u.created_at}  |  ${conf}`)
    })
}

console.log('\n=================================================')
console.log('2) PERFILES en public.perfiles')
console.log('=================================================')
const { data: perfiles, error: e2 } = await sb.from('perfiles').select('*').order('created_at', { ascending: false })
if (e2) console.log('ERROR:', e2.message)
else perfiles.forEach(p => console.log(`  ${p.email}  |  rol: ${p.rol}  |  creado: ${p.created_at}`))

console.log('\n=================================================')
console.log('3) ESPACIOS en public.espacios')
console.log('=================================================')
const { data: espacios, error: e3 } = await sb.from('espacios').select('*').order('created_at', { ascending: false })
if (e3) console.log('ERROR:', e3.message)
else espacios.forEach(e => console.log(`  ${e.nombre}  |  ${e.tipo}  |  slug: ${e.slug}  |  creado: ${e.created_at}`))

console.log('\n=================================================')
console.log('4) MIEMBROS — ¿quién es miembro de qué espacio?')
console.log('=================================================')
const { data: miembros, error: e4 } = await sb
  .from('espacio_miembros')
  .select('espacio_id, perfil_id, rol, espacios(nombre,tipo), perfiles(email)')
if (e4) console.log('ERROR:', e4.message)
else miembros.forEach(m => console.log(`  ${m.perfiles?.email}  ↔  ${m.espacios?.nombre} (${m.espacios?.tipo})  | rol: ${m.rol}`))

console.log('\n=================================================')
console.log('5) ¿Diferencia auth.users vs perfiles? (los que no tienen perfil)')
console.log('=================================================')
const perfilIds = new Set((perfiles ?? []).map(p => p.id))
const sinPerfil = (authUsers?.users ?? []).filter(u => !perfilIds.has(u.id))
if (sinPerfil.length === 0) console.log('  ✅ Todos tienen perfil')
else sinPerfil.forEach(u => console.log(`  ❌ ${u.email}  |  uid: ${u.id}  |  creado: ${u.created_at}  ← FALTA PERFIL`))
