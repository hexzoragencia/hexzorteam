// Importa el Excel "FINANZAS PERSONALES VICTOR ROSSO" al espacio personal "victor rosso".
// Lee primero data-personal.json (generado por export-personal.py) e inserta a Supabase.
// Es idempotente: limpia categorías/transacciones/fondos/deudas del espacio y vuelve a insertar.

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
const data = JSON.parse(readFileSync(new URL('./data-personal.json', import.meta.url), 'utf8'))

console.log(`📥 Importando al espacio victor rosso (${ESPACIO_ID})`)
console.log(`   ${data.categorias.length} categorías · ${data.presupuestos.length} presupuestos · ${data.transacciones.length} transacciones · ${data.fondos.length} fondos · ${data.deudas.length} deudas`)

// 1. LIMPIAR
console.log('\n🧹 Limpiando datos previos del espacio…')
await sb.from('transacciones').delete().eq('espacio_id', ESPACIO_ID)
await sb.from('presupuestos_mensuales').delete().in('categoria_id',
  ((await sb.from('categorias').select('id').eq('espacio_id', ESPACIO_ID)).data || []).map(r => r.id)
)
await sb.from('categorias').delete().eq('espacio_id', ESPACIO_ID)
await sb.from('fondos_reserva').delete().eq('espacio_id', ESPACIO_ID)
await sb.from('deudas').delete().eq('espacio_id', ESPACIO_ID)

// 2. CATEGORÍAS
console.log('\n📁 Insertando categorías…')
const catsToInsert = data.categorias.map(c => ({
  espacio_id: ESPACIO_ID, tipo: c.tipo, nombre: c.nombre, orden: c.orden, activo: true
}))
const { data: catsInserted, error: e1 } = await sb.from('categorias').insert(catsToInsert).select('id, tipo, nombre')
if (e1) { console.error('Error categorías:', e1); process.exit(1) }
const catMap = {}  // "tipo|nombre" -> id
catsInserted.forEach(c => { catMap[`${c.tipo}|${c.nombre}`] = c.id })
console.log(`   ✅ ${catsInserted.length} categorías insertadas`)

// 3. PRESUPUESTOS MENSUALES
console.log('\n📅 Insertando presupuestos mensuales…')
const presToInsert = data.presupuestos
  .map(p => ({
    categoria_id: catMap[`${p.tipo}|${p.nombre}`],
    ano: p.ano, mes: p.mes,
    monto_esperado: p.monto_esperado,
    fecha_esperada: p.fecha_esperada
  }))
  .filter(p => p.categoria_id && p.monto_esperado > 0)
const { error: e2 } = await sb.from('presupuestos_mensuales').insert(presToInsert)
if (e2) { console.error('Error presupuestos:', e2); process.exit(1) }
console.log(`   ✅ ${presToInsert.length} presupuestos insertados`)

// 4. TRANSACCIONES
console.log('\n💸 Insertando transacciones…')
let matched = 0, unmatched = 0
const txToInsert = data.transacciones.map(t => {
  // Buscar categoría: por nombre exacto en cualquier tipo
  let catId = null
  for (const tipo of ['gasto_mensual','pago_programado','suscripcion','ingreso','ahorro','deuda']) {
    if (catMap[`${tipo}|${t.rubro}`]) { catId = catMap[`${tipo}|${t.rubro}`]; break }
  }
  if (catId) matched++; else unmatched++
  return {
    espacio_id: ESPACIO_ID,
    categoria_id: catId,
    fecha: t.fecha,
    monto: t.monto,
    descripcion: t.descripcion || t.rubro
  }
})
const { error: e3 } = await sb.from('transacciones').insert(txToInsert)
if (e3) { console.error('Error transacciones:', e3); process.exit(1) }
console.log(`   ✅ ${txToInsert.length} transacciones insertadas (${matched} con categoría, ${unmatched} sin categoría)`)

// 5. FONDOS DE RESERVA
console.log('\n🏦 Insertando fondos de reserva…')
const fondosToInsert = data.fondos.map(f => ({
  espacio_id: ESPACIO_ID, nombre: f.nombre, meta: f.meta,
  pago_mensual: f.pago_mensual || 0, inicial: f.inicial || 0, ahorrado: f.ahorrado || 0
}))
if (fondosToInsert.length) {
  const { error: e4 } = await sb.from('fondos_reserva').insert(fondosToInsert)
  if (e4) { console.error('Error fondos:', e4); process.exit(1) }
}
console.log(`   ✅ ${fondosToInsert.length} fondos insertados`)

// 6. DEUDAS
console.log('\n💳 Insertando deudas…')
const deudasToInsert = data.deudas.map((d, i) => ({
  espacio_id: ESPACIO_ID, nombre: d.nombre,
  balance: d.balance, interes_anual: d.interes_anual,
  cuota_mensual: d.cuota_mensual, orden: i
}))
if (deudasToInsert.length) {
  const { error: e5 } = await sb.from('deudas').insert(deudasToInsert)
  if (e5) { console.error('Error deudas:', e5); process.exit(1) }
}
console.log(`   ✅ ${deudasToInsert.length} deudas insertadas`)

console.log('\n🎉 IMPORT COMPLETADO')
