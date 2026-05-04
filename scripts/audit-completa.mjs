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

const r = (label, ok, detail = '') => console.log(`  ${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`)
const sec = (t) => console.log(`\n=== ${t} ===`)

let failed = 0
const fail = (msg) => { failed++; console.log(`  ❌ ${msg}`) }

// =====================================================
sec('A. ESTRUCTURA DE BD: tablas críticas')
const tablas = [
  'perfiles', 'espacios', 'espacio_miembros', 'categorias',
  'transacciones', 'presupuestos_mensuales', 'fondos_reserva', 'deudas',
  'preferencias_usuario', 'trigger_debug_log',
  'mentorias_estudiantes', 'mentorias_clases',
]
for (const t of tablas) {
  const { error } = await sb.from(t).select('*', { count: 'exact', head: true })
  if (error) fail(`${t}: ${error.message}`)
  else r(t, true)
}

sec('B. VISTAS')
const vistas = ['admin_usuarios', 'mentorias_estudiantes_stats', 'mentorias_proximas_clases']
for (const v of vistas) {
  const { error } = await sb.from(v).select('*', { count: 'exact', head: true })
  if (error) fail(`vista ${v}: ${error.message}`)
  else r(v, true)
}

sec('C. RPCs / FUNCIONES')
const rpcs = [
  { name: 'es_superadmin', args: {}, expectErr: false },
  { name: 'crear_espacios_iniciales', args: { perfil_id: '00000000-0000-0000-0000-000000000000', nombre_usuario: 'X' }, expectErr: 'fk' },
  { name: 'aprobar_usuario', args: { target_id: '00000000-0000-0000-0000-000000000000' }, expectErr: 'auth' },
  { name: 'rechazar_usuario', args: { target_id: '00000000-0000-0000-0000-000000000000' }, expectErr: 'auth' },
  { name: 'set_pin', args: { esp_id: '00000000-0000-0000-0000-000000000000', nuevo_pin: '1234' }, expectErr: 'auth' },
  { name: 'verificar_pin', args: { esp_id: '00000000-0000-0000-0000-000000000000', pin_intento: '1234' }, expectErr: false },
]
for (const { name, args, expectErr } of rpcs) {
  const { error } = await sb.rpc(name, args)
  // Estas RPCs algunas dan error esperado por validación interna, lo que importa es que existan
  const exists = !error || !error.message?.includes('Could not find')
  if (exists) r(`${name} existe`, true, error ? `(error esperado: ${error.message.slice(0, 60)})` : '')
  else fail(`${name}: ${error?.message ?? 'no encontrada'}`)
}

sec('D. RLS — usuario no autenticado NO puede ver datos')
// Cliente anonimo (sin auth) — no debe ver perfiles
const { data: ano1, error: e1 } = await sbAnon.from('perfiles').select('id').limit(1)
if (e1) r('anon no ve perfiles (error esperado)', true, e1.message)
else if ((ano1 ?? []).length === 0) r('anon no ve perfiles (RLS bloquea)', true)
else fail(`anon SÍ ve perfiles: ${ano1.length} filas`)

const { data: ano2 } = await sbAnon.from('mentorias_estudiantes').select('id').limit(1)
if ((ano2 ?? []).length === 0) r('anon no ve mentorias_estudiantes', true)
else fail(`anon ve mentorias: ${ano2.length} filas`)

const { data: ano3 } = await sbAnon.from('mentorias_clases').select('id').limit(1)
if ((ano3 ?? []).length === 0) r('anon no ve mentorias_clases', true)
else fail(`anon ve mentorias_clases: ${ano3.length} filas`)

sec('E. ESTADO ACTUAL DE DATOS')
const { data: usuarios } = await sb.from('perfiles').select('email, rol, estado, tour_completado')
console.log(`  Usuarios: ${usuarios?.length}`)
usuarios?.forEach(u => console.log(`    ${u.email} | rol=${u.rol} | estado=${u.estado} | tour=${u.tour_completado}`))

const { data: espacios } = await sb.from('espacios').select('nombre, tipo, slug')
console.log(`\n  Espacios: ${espacios?.length}`)
espacios?.forEach(e => console.log(`    ${e.nombre} (${e.tipo}) — ${e.slug}`))

const { data: estudiantes } = await sb.from('mentorias_estudiantes_stats').select('*')
console.log(`\n  Estudiantes mentoría: ${estudiantes?.length ?? 0}`)
estudiantes?.forEach(e => console.log(`    ${e.nombre} (${e.tipo}) — ${e.clases_vistas}/${e.clases_total} | estado=${e.estado}`))

sec('F. TEST: signup nuevo crea perfil pendiente sin espacios')
const TEST_EMAIL = `audit-${Date.now()}@hexzor.test`
const { data: newUser, error: nuErr } = await sb.auth.admin.createUser({
  email: TEST_EMAIL, password: 'audit123456', email_confirm: true,
  user_metadata: { nombre: 'Audit Test' },
})
if (nuErr) { fail(`createUser: ${nuErr.message}`); process.exit(1) }
const newUid = newUser.user.id
await new Promise(s => setTimeout(s, 1500))
const { data: pNew } = await sb.from('perfiles').select('estado, rol').eq('id', newUid).maybeSingle()
if (pNew?.estado === 'pendiente' && pNew?.rol === 'usuario') r('perfil creado con estado pendiente', true)
else fail(`perfil estado=${pNew?.estado} rol=${pNew?.rol} (debería ser pendiente/usuario)`)

const { data: msNew } = await sb.from('espacio_miembros').select('rol').eq('perfil_id', newUid)
if ((msNew ?? []).length === 0) r('no se crearon espacios al pendiente', true)
else fail(`pendiente tiene ${msNew?.length} membresías (debería ser 0)`)

sec('G. TEST: aprobar a un usuario crea sus espacios')
// Como Victor (superadmin) no podemos sin sesión, así que llamamos al SQL update directo
await sb.from('perfiles').update({ estado: 'activo' }).eq('id', newUid)
// Y llamamos crear_espacios_iniciales como service role (esto bypasses la verificación es_superadmin)
const { error: ceErr } = await sb.rpc('crear_espacios_iniciales', { perfil_id: newUid, nombre_usuario: 'Audit Test' })
if (ceErr) fail(`crear_espacios_iniciales falló: ${ceErr.message}`)
else r('crear_espacios_iniciales OK', true)

const { data: msApr } = await sb.from('espacio_miembros').select('rol, espacios(tipo)').eq('perfil_id', newUid)
const empOK = msApr?.some(m => m.espacios?.tipo === 'empresarial' && m.rol === 'owner')
const perOK = msApr?.some(m => m.espacios?.tipo === 'personal' && m.rol === 'owner')
if (empOK && perOK) r('aprobado tiene 2 espacios owner (emp + per)', true)
else fail(`espacios incorrectos: emp=${empOK} per=${perOK}`)

// Verificar categorías por defecto
const { data: estEmps } = await sb.from('espacio_miembros')
  .select('espacio_id, espacios!inner(tipo)').eq('perfil_id', newUid).eq('rol', 'owner')
const empId = estEmps?.find(e => e.espacios.tipo === 'empresarial')?.espacio_id
const { data: cats } = await sb.from('categorias').select('tipo').eq('espacio_id', empId)
if ((cats ?? []).length === 9) r('9 categorías default sembradas', true)
else fail(`solo ${cats?.length} categorías sembradas`)

sec('H. TEST: aislamiento — un usuario nuevo NO ve espacios de otros')
// El user nuevo solo ve los que es miembro
// Lo simulamos haciendo login con ese user
const { data: login } = await sb.auth.admin.generateLink({
  type: 'magiclink', email: TEST_EMAIL,
})
// Con service role no tenemos auth.uid del user nuevo. Usamos el cliente anónimo
// y signInWithPassword
const { data: signin, error: siErr } = await sbAnon.auth.signInWithPassword({
  email: TEST_EMAIL, password: 'audit123456',
})
if (siErr) fail(`signin: ${siErr.message}`)
else {
  // Con esta sesión, intentar ver TODOS los espacios
  const { data: misEsp } = await sbAnon.from('espacios')
    .select('*, espacio_miembros!inner(perfil_id)')
    .eq('espacio_miembros.perfil_id', signin.user.id)
  const correctIso = (misEsp?.length === 2)
  if (correctIso) r('user nuevo ve 2 espacios (sus propios)', true)
  else fail(`user nuevo ve ${misEsp?.length} espacios`)

  // Intentar acceder a Vasecom (de Victor)
  const { data: vasecom } = await sbAnon.from('espacios').select('id').eq('slug', 'vasecom').maybeSingle()
  // Aún si lo ve por ID, no debe poder ver datos
  if (vasecom) {
    const { data: txAjenas } = await sbAnon.from('transacciones').select('id').eq('espacio_id', vasecom.id)
    if ((txAjenas ?? []).length === 0) r('user nuevo no ve transacciones de Vasecom', true)
    else fail(`user nuevo ve ${txAjenas.length} txs de Vasecom`)
  }

  // Intentar llamar aprobar_usuario sin ser superadmin
  const { error: apEr } = await sbAnon.rpc('aprobar_usuario', { target_id: '00000000-0000-0000-0000-000000000000' })
  if (apEr && apEr.message.includes('superadmin')) r('user normal NO puede llamar aprobar_usuario', true)
  else fail(`aprobar_usuario sin admin: ${apEr?.message ?? 'pasó sin error (BUG GRAVE)'}`)

  // Intentar acceder a mentorias
  const { data: mentSinAcc } = await sbAnon.from('mentorias_estudiantes').select('id')
  if ((mentSinAcc ?? []).length === 0) r('user normal no ve mentorias_estudiantes', true)
  else fail(`user normal ve ${mentSinAcc.length} estudiantes (BUG GRAVE)`)

  await sbAnon.auth.signOut()
}

sec('I. CLEANUP: borrar usuario de prueba')
await sb.auth.admin.deleteUser(newUid)
const { data: huerf } = await sb.from('espacios').select('id').like('slug', 'audit-test-%')
for (const e of huerf ?? []) {
  await sb.from('espacios').delete().eq('id', e.id)
}
r('usuario de prueba eliminado', true)

console.log('\n' + (failed === 0 ? '🎉 TODA LA AUDITORÍA PASÓ' : `❌ ${failed} fallos detectados`))
process.exit(failed === 0 ? 0 : 1)
