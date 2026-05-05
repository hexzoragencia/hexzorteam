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

// Buscar el espacio Vasecom
const { data: vasecom } = await sb.from('espacios').select('id').eq('slug', 'vasecom').single()
if (!vasecom) { console.log('❌ No se encontró Vasecom'); process.exit(1) }
const ESP = vasecom.id
console.log(`✅ Vasecom encontrado: ${ESP}\n`)

// === 1. Importar páginas ganadoras ===
console.log('=== Importando páginas ganadoras ===')
const paginas = JSON.parse(readFileSync('/tmp/paginas_import.json', 'utf8'))

// Asegurar que todas las URLs tengan protocolo
function fixUrl(u) {
  u = u.trim()
  if (!u.startsWith('http')) return 'https://' + u
  return u
}

const rows = paginas.map(p => ({ espacio_id: ESP, pais: p.pais, url: fixUrl(p.url) }))

// Borrar las que ya estén (idempotente — para no duplicar si re-corres)
await sb.from('emp_paginas').delete().eq('espacio_id', ESP)
const { data: ins, error: e1 } = await sb.from('emp_paginas').insert(rows).select('id')
if (e1) { console.log(`❌ ${e1.message}`); process.exit(1) }
console.log(`✅ ${ins.length} páginas importadas a Vasecom`)

// === 2. Crear placeholders de accesos (sin contraseñas) ===
console.log('\n=== Creando placeholders de accesos ===')
const accesos = [
  // TikTok del equipo
  { plataforma: 'tiktok', etiqueta: 'TikTok Valentina', persona: 'Valentina' },
  { plataforma: 'tiktok', etiqueta: 'TikTok Victor', persona: 'Victor' },
  { plataforma: 'tiktok', etiqueta: 'TikTok Sebas', persona: 'Sebas' },
  { plataforma: 'tiktok', etiqueta: 'TikTok Vasecom', persona: 'Vasecom' },
  // ChatGPTs
  { plataforma: 'otro', etiqueta: 'GPT Logos', notas: 'GPT custom para crear logos' },
  { plataforma: 'otro', etiqueta: 'GPT Prom Chatea', notas: 'GPT promociones' },
  { plataforma: 'otro', etiqueta: 'GPT Creativos', notas: 'GPT para creativos de ads' },
  { plataforma: 'otro', etiqueta: 'GPT Landings', notas: 'GPT para landings' },
  // Cuentas operativas
  { plataforma: 'shopify', etiqueta: 'Shopify Vasecom' },
  { plataforma: 'otro', etiqueta: 'Dropi' },
  { plataforma: 'tiktok', etiqueta: 'TikTok ADS Manager' },
  { plataforma: 'meta_business', etiqueta: 'Meta Business Suite' },
  // Correos
  { plataforma: 'correo', etiqueta: 'Gmail Vasecom' },
  { plataforma: 'correo', etiqueta: 'ProtonMail Vasecom' },
].map(a => ({ espacio_id: ESP, ...a }))

// Borrar previos para evitar duplicados
await sb.from('emp_accesos').delete().eq('espacio_id', ESP)
const { error: e2 } = await sb.from('emp_accesos').insert(accesos)
if (e2) { console.log(`❌ ${e2.message}`); process.exit(1) }
console.log(`✅ ${accesos.length} placeholders de acceso creados (sin contraseñas — los rellenas desde la app)`)

console.log('\n🎉 Import completo. Refresca la app y mira Páginas / Accesos.')
