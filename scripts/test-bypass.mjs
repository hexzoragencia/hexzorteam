// Verifica que un user pendiente NO pueda acceder a /e/[slug]/dashboard
// (después del fix en requireEspacio).

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map(l => l.split('='))
    .map(([k, ...r]) => [k.trim(), r.join('=').trim()])
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})
const sbAnon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// Crear user pendiente
const TEST_EMAIL = `bypass-${Date.now()}@hexzor.test`
const { data: nu, error: nuErr } = await sb.auth.admin.createUser({
  email: TEST_EMAIL, password: 'pwd123456', email_confirm: true,
  user_metadata: { nombre: 'Bypass Test' },
})
if (nuErr) { console.log('❌ createUser:', nuErr.message); process.exit(1) }
const uid = nu.user.id
await new Promise(r => setTimeout(r, 1500))

// Verificar que está pendiente sin espacios
const { data: p } = await sb.from('perfiles').select('estado').eq('id', uid).single()
console.log(`Estado del nuevo user: ${p.estado} (esperado: pendiente)`)

// Login con el user pendiente
const { data: signin, error: siErr } = await sbAnon.auth.signInWithPassword({
  email: TEST_EMAIL, password: 'pwd123456',
})
if (siErr) { console.log('❌ signin:', siErr.message); process.exit(1) }
console.log('✅ Login funcionó (con sesión activa)')

// Intento BYPASS: leer un espacio existente directamente vía Supabase
// Si las tablas tienen RLS, no debería poder leer espacios donde no es miembro
const { data: vasecom } = await sbAnon.from('espacios').select('id, slug').eq('slug', 'vasecom').maybeSingle()
console.log(`Vasecom desde user pendiente: ${vasecom ? '⚠️ visible (id=' + vasecom.id + ')' : '✅ no visible'}`)

if (vasecom) {
  const { data: tx } = await sbAnon.from('transacciones').select('id').eq('espacio_id', vasecom.id)
  console.log(`Transacciones de Vasecom: ${tx?.length === 0 ? '✅ ninguna visible' : `⚠️ ${tx.length} visibles`}`)
}

// Verificar que el user pendiente solo se ve a sí mismo en perfiles
const { data: ps } = await sbAnon.from('perfiles').select('email')
console.log(`Perfiles que ve user pendiente: ${ps?.length} (esperado: 1, solo él)`)

await sbAnon.auth.signOut()
await sb.auth.admin.deleteUser(uid)
console.log('\nCleanup OK')
