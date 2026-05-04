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

// Test 1: ¿La función crear_espacios_iniciales funciona si la llamamos directo?
// Vamos a usar el id de zenhubcompany (el que quedó sin perfil)
const TEST_UID = 'acfa7cac-4726-4fe8-9948-05c2d15b6650'

console.log('TEST 1: ¿unaccent disponible?')
const { data: ua, error: uaErr } = await sb.rpc('unaccent', { input: 'María' }).maybeSingle()
console.log('  result:', ua, '| error:', uaErr?.message ?? 'OK')

console.log('\nTEST 2: Ver el perfil del usuario problema antes de crearlo')
const { data: pBefore } = await sb.from('perfiles').select('*').eq('id', TEST_UID).maybeSingle()
console.log('  Perfil existente:', pBefore ?? 'NINGUNO')

console.log('\nTEST 3: Crear el perfil manualmente para ver si pasa')
const { error: insErr } = await sb.from('perfiles').insert({
  id: TEST_UID,
  email: 'zenhubcompany@gmail.com',
  nombre: 'Zenhub',
  rol: 'usuario',
})
console.log('  Insert perfil:', insErr ? `❌ ${insErr.message}` : '✅ OK')

console.log('\nTEST 4: Llamar crear_espacios_iniciales directo')
const { data: rpc, error: rpcErr } = await sb.rpc('crear_espacios_iniciales', {
  perfil_id: TEST_UID,
  nombre_usuario: 'Zenhub',
})
console.log('  RPC result:', rpc, '| error:', rpcErr?.message ?? 'OK')

console.log('\nTEST 5: Ver si quedaron espacios')
const { data: emps } = await sb.from('espacio_miembros').select('rol, espacios(nombre, tipo, slug)').eq('perfil_id', TEST_UID)
console.log('  Espacios del usuario:', emps)
