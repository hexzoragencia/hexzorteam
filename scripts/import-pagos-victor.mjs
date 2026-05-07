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

// Buscar el espacio personal "victor rosso" de Victor (hexzoragencia)
const { data: victor } = await sb.from('perfiles').select('id').eq('email', 'hexzoragencia@gmail.com').single()
const { data: espacio } = await sb.from('espacios').select('id').eq('slug', 'victor-rosso-wv06').single()
if (!espacio) { console.log('❌ No se encontró espacio victor-rosso-wv06'); process.exit(1) }
const ESP = espacio.id
console.log(`✅ Espacio personal "victor rosso": ${ESP}\n`)

// Pagos extraídos del Excel ENE 2026 (datos llenos)
const pagos = [
  // PAGOS PROGRAMADOS
  { nombre: 'TARJETA CRÉDITO CLÁSICA', monto: 150000, dia_pago: 1, recurrencia: 'mensual' },
  { nombre: 'ARRIENDO MADRE',          monto: 400000, dia_pago: 1, recurrencia: 'mensual' },
  { nombre: 'SERVICIOS',                monto: 300000, dia_pago: 10, recurrencia: 'mensual' },
  { nombre: 'WESTERN UNION',            monto: 800000, dia_pago: 1, recurrencia: 'mensual' },
  { nombre: 'ARRIENDO',                 monto: 2100000, dia_pago: 1, recurrencia: 'mensual' },
  { nombre: 'PAGO DE EMPLEADO',         monto: 1000000, dia_pago: 15, recurrencia: 'mensual' },
  { nombre: 'TARJETA GREEN MASTER',     monto: 840000, dia_pago: 1, recurrencia: 'mensual' },
  { nombre: 'EMPLEADO SAMUEL',          monto: 500000, dia_pago: 5, recurrencia: 'mensual' },
  { nombre: 'EMPLEADO JUAN',            monto: 800000, dia_pago: 5, recurrencia: 'mensual' },
  // SUSCRIPCIONES
  { nombre: 'CELULAR ROSSO',            monto: 45000, dia_pago: 10, recurrencia: 'mensual' },
  { nombre: 'CELULAR MADRE',            monto: 40000, dia_pago: 15, recurrencia: 'mensual' },
  { nombre: 'INTERNET DE CASA',         monto: 30000, dia_pago: 7, recurrencia: 'mensual' },
  { nombre: 'VERIFICADO',               monto: 40000, dia_pago: 10, recurrencia: 'mensual' },
  { nombre: 'GOOGLE ONE',               monto: 40000, dia_pago: 10, recurrencia: 'mensual' },
  { nombre: 'INTERNET CASA PROPIA',     monto: 65000, dia_pago: 7, recurrencia: 'mensual' },
  { nombre: 'APPLE',                    monto: 33500, dia_pago: 15, recurrencia: 'mensual' },
]

// Buscar categorías para asignarlas
const { data: cats } = await sb.from('categorias').select('id, nombre, tipo').eq('espacio_id', ESP)
const catPP = (cats ?? []).find(c => c.tipo === 'pago_programado')
const catSus = (cats ?? []).find(c => c.tipo === 'suscripcion')

// Borrar previos para no duplicar
await sb.from('pagos_programados').delete().eq('espacio_id', ESP)

// Asignar categoría según el grupo (los primeros 9 son pago_programado, resto suscripcion)
const inserts = pagos.map((p, i) => ({
  espacio_id: ESP,
  nombre: p.nombre,
  monto: p.monto,
  dia_pago: p.dia_pago,
  recurrencia: p.recurrencia,
  activo: true,
  categoria_id: i < 9 ? (catPP?.id ?? null) : (catSus?.id ?? null),
}))

const { data: ins, error } = await sb.from('pagos_programados').insert(inserts).select('id')
if (error) { console.log('❌', error.message); process.exit(1) }

console.log(`✅ Importados ${ins.length} pagos a tu espacio personal:`)
const total = pagos.reduce((s, p) => s + p.monto, 0)
console.log(`\nTotal mensual: $${total.toLocaleString('es-CO')}`)
console.log('\nDetalle:')
pagos.forEach(p => console.log(`  $${p.monto.toLocaleString('es-CO')} día ${p.dia_pago} — ${p.nombre}`))
