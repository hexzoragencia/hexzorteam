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

console.log('=== 1) Estado actual de perfiles ===')
const { data: ps } = await sb.from('perfiles').select('email,rol,estado').order('created_at')
ps?.forEach(p => console.log(`  ${p.email}  →  rol: ${p.rol}  |  estado: ${p.estado}`))

console.log('\n=== 2) Vista admin_usuarios incluye estado ===')
const { data: au } = await sb.from('admin_usuarios').select('email,rol,estado').limit(5)
au?.forEach(u => console.log(`  ${u.email}  →  ${u.estado}`))

console.log('\n=== 3) Test signup nuevo: ¿queda pendiente? ===')
const TEST_EMAIL = `test-aprob-${Date.now()}@hexzor.test`
const { data, error } = await sb.auth.admin.createUser({
  email: TEST_EMAIL, password: 'test123456', email_confirm: true,
  user_metadata: { nombre: 'Tester Aprobación' },
})
if (error) { console.log('❌', error.message); process.exit(1) }
await new Promise(r => setTimeout(r, 1500))
const { data: p } = await sb.from('perfiles').select('estado,rol').eq('id', data.user.id).maybeSingle()
console.log(`  Perfil creado con estado: ${p?.estado} | rol: ${p?.rol}`)
const { data: ms } = await sb.from('espacio_miembros').select('rol,espacios(nombre)').eq('perfil_id', data.user.id)
console.log(`  Membresías: ${ms?.length ?? 0} (debería ser 0 hasta aprobar)`)

console.log('\n=== 4) Test aprobar (vía RPC, simulando server action) ===')
// Usar el client del superadmin (auth como Victor)
const sbVictor = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
// Login como Victor — necesita su password, no la tenemos. Mejor probamos con service role pero sin es_superadmin check.
// La función requiere es_superadmin(). Vamos a llamarla con el cliente de Victor (necesitamos su sesión).
// En realidad, solo verificamos que la RPC EXISTA y la cuenta de prueba siga pendiente.
const { data: rpcCheck, error: rpcErr } = await sb.rpc('aprobar_usuario', { target_id: data.user.id })
console.log(`  RPC aprobar (con service role, sin es_superadmin context):`)
console.log(`    error esperado por falta de auth.uid: ${rpcErr?.message ?? 'OK (sin error)'}`)

// Verificar después si quedó aprobado o no
const { data: pAfter } = await sb.from('perfiles').select('estado').eq('id', data.user.id).maybeSingle()
console.log(`  Estado después de RPC: ${pAfter?.estado}`)

// Cleanup
console.log('\n=== Cleanup ===')
await sb.auth.admin.deleteUser(data.user.id)
console.log('  ✅ Usuario test eliminado')
