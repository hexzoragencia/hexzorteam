// Importa hábitos + objetivos al espacio personal "victor rosso".
// Es idempotente: limpia los anteriores del espacio antes de insertar.

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

const ESPACIO_ID = '38cd40f2-ab55-411f-8107-045bf1960830' // "victor rosso"
const data = JSON.parse(readFileSync(new URL('./data-habitos-objetivos.json', import.meta.url), 'utf8'))

console.log(`📥 Importando ${data.habitos.length} hábitos y ${data.objetivos.length} objetivos al espacio victor rosso`)

// Verificar que las tablas existen
const { error: probeErr } = await sb.from('habitos').select('id', { head: true, count: 'exact' }).limit(1)
if (probeErr) {
  console.error('\n❌ Tabla "habitos" no existe. Pega primero los SQLs de migración en Supabase.\n')
  console.error('   Error:', probeErr.message)
  process.exit(1)
}

// === HÁBITOS ===
console.log('\n🧹 Limpiando hábitos previos…')
await sb.from('habitos').delete().eq('espacio_id', ESPACIO_ID)

console.log('✨ Insertando hábitos…')
const habitosToInsert = data.habitos.map((h, i) => ({
  espacio_id: ESPACIO_ID,
  nombre: h.nombre,
  orden: i,
}))
const { error: e1 } = await sb.from('habitos').insert(habitosToInsert)
if (e1) { console.error('Error hábitos:', e1); process.exit(1) }
console.log(`   ✅ ${habitosToInsert.length} hábitos insertados`)

// === OBJETIVOS ===
console.log('\n🧹 Limpiando objetivos previos…')
await sb.from('objetivos').delete().eq('espacio_id', ESPACIO_ID)

console.log('🎯 Insertando objetivos…')
const objetivosToInsert = data.objetivos.map((o, i) => ({
  espacio_id: ESPACIO_ID,
  titulo: o.titulo,
  tipo: o.tipo,
  estado: o.estado,
  ingreso_esperado: o.ingreso_esperado,
  ganancia_esperada: o.ganancia_esperada,
  cantidad: o.cantidad,
  progreso: o.progreso,
  orden: i,
}))
const { error: e2 } = await sb.from('objetivos').insert(objetivosToInsert)
if (e2) { console.error('Error objetivos:', e2); process.exit(1) }
console.log(`   ✅ ${objetivosToInsert.length} objetivos insertados`)

console.log('\n🎉 IMPORT COMPLETADO')
