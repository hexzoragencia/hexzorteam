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

const TEST_EMAIL = `test-trigger-${Date.now()}@hexzor.test`
const TEST_NAME = 'Tester Diag'

console.log(`Creando usuario ${TEST_EMAIL} via Admin API...`)
const { data, error } = await sb.auth.admin.createUser({
  email: TEST_EMAIL,
  password: 'testpassword123',
  email_confirm: true,
  user_metadata: { nombre: TEST_NAME },
})
if (error) { console.log('❌ Error en createUser:', error.message); process.exit(1) }
console.log(`✅ Auth user creado, uid: ${data.user.id}`)

// Esperar 2 seg para que los triggers terminen
await new Promise(r => setTimeout(r, 2000))

// Verificar perfil
const { data: p } = await sb.from('perfiles').select('*').eq('id', data.user.id).maybeSingle()
console.log(`\nPerfil creado: ${p ? '✅ SÍ' : '❌ NO'}`)
if (p) console.log('  ', JSON.stringify(p))

// Verificar membresías
const { data: ms } = await sb.from('espacio_miembros')
  .select('rol, espacios(nombre,tipo,slug)').eq('perfil_id', data.user.id)
console.log(`\nMembresías (${ms?.length ?? 0}):`)
ms?.forEach(m => console.log(`  ${m.rol} de ${m.espacios?.nombre} (${m.espacios?.tipo})`))

// Cleanup: borrar el usuario de prueba
console.log(`\nLimpiando usuario de prueba...`)
await sb.auth.admin.deleteUser(data.user.id)
console.log('✅ Usuario eliminado')
