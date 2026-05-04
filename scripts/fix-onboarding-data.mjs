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

// 1. Sacar a los usuarios de prueba de Vasecom (lo agregó el trigger viejo)
console.log('=== 1. Quitando usuarios de prueba de Vasecom ===')
const { data: vasecom } = await sb.from('espacios').select('id').eq('slug', 'vasecom').single()
const { data: testProfiles } = await sb.from('perfiles').select('id, email')
  .in('email', ['victorrosso2311@gmail.com', 'zenhubcompany@gmail.com'])

for (const p of testProfiles ?? []) {
  const { error } = await sb.from('espacio_miembros').delete()
    .eq('espacio_id', vasecom.id).eq('perfil_id', p.id)
  console.log(`  ${p.email} fuera de Vasecom: ${error ? '❌ ' + error.message : '✅'}`)
}

// 2. Asegurar que victorrosso2311 tenga espacios propios (zenhub ya los tiene del test anterior)
console.log('\n=== 2. Crear espacios propios para victorrosso2311 ===')
const v = (testProfiles ?? []).find(p => p.email === 'victorrosso2311@gmail.com')
if (v) {
  const { data: yaTiene } = await sb.from('espacio_miembros')
    .select('espacios!inner(tipo,slug)').eq('perfil_id', v.id).eq('rol', 'owner')
  const tieneEmp = yaTiene?.some(m => m.espacios?.tipo === 'empresarial')
  const tienePer = yaTiene?.some(m => m.espacios?.tipo === 'personal')
  console.log(`  Estado actual: emp=${tieneEmp ? '✅' : '❌'} per=${tienePer ? '✅' : '❌'}`)
  if (!tieneEmp || !tienePer) {
    // Solo creamos lo que falta llamando al RPC (crea ambos pero con on conflict do nothing en categorías)
    const { error } = await sb.rpc('crear_espacios_iniciales', { perfil_id: v.id, nombre_usuario: 'Victor Rosso' })
    console.log(`  Llamada a crear_espacios_iniciales: ${error ? '❌ ' + error.message : '✅'}`)
  }

  // Actualizar rol a 'usuario' (estaba como 'socio' por trigger viejo)
  const { error: re } = await sb.from('perfiles').update({ rol: 'usuario' }).eq('id', v.id)
  console.log(`  Rol actualizado a 'usuario': ${re ? '❌ ' + re.message : '✅'}`)
}

// 3. Asegurar zenhub también con rol usuario
console.log('\n=== 3. Asegurar rol "usuario" para zenhubcompany ===')
const z = (testProfiles ?? []).find(p => p.email === 'zenhubcompany@gmail.com')
if (z) {
  const { error } = await sb.from('perfiles').update({ rol: 'usuario' }).eq('id', z.id)
  console.log(`  Rol actualizado: ${error ? '❌ ' + error.message : '✅'}`)
}

// 4. Verificación final
console.log('\n=== 4. Estado final ===')
const { data: perfiles } = await sb.from('perfiles').select('email, rol').order('created_at')
console.log('PERFILES:')
perfiles?.forEach(p => console.log(`  ${p.email}  →  rol: ${p.rol}`))

const { data: miembros } = await sb.from('espacio_miembros')
  .select('perfiles(email), rol, espacios(nombre,tipo)')
console.log('\nMIEMBROS:')
miembros?.sort((a,b) => (a.perfiles?.email ?? '').localeCompare(b.perfiles?.email ?? ''))
  .forEach(m => console.log(`  ${m.perfiles?.email}  ↔  ${m.espacios?.nombre} (${m.espacios?.tipo}) | ${m.rol}`))
