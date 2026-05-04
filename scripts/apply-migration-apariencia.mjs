import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(Boolean)
    .map(l => l.split('='))
    .map(([k, ...rest]) => [k.trim(), rest.join('=').trim()])
);

const sql = readFileSync(new URL('../lib/supabase/migration_apariencia.sql', import.meta.url), 'utf8');

// Supabase REST no soporta SQL arbitrario; necesitamos la API de pg-meta o pg-rest.
// Workaround: usar el endpoint de pg-meta /pg/query (solo disponible vía Management API).
// Más simple: usar el endpoint /rest/v1/rpc con una función execute_sql custom, o la conexión directa.
//
// Como no queremos pedir más al usuario, usamos el endpoint de la Management API del proyecto.
// PERO ese requiere project ID + access token, no service role.
//
// Alternativa práctica: pedir al usuario que pegue el SQL en su dashboard una sola vez.
// Imprimimos instrucciones claras.

console.log('━'.repeat(60));
console.log('📋 SQL a pegar en Supabase (apariencia)');
console.log('━'.repeat(60));
console.log();
console.log('1. Abre: https://supabase.com/dashboard');
console.log('2. Entra a tu proyecto Hexzor');
console.log('3. Menú izquierdo → "SQL Editor"');
console.log('4. Click en "New query"');
console.log('5. Pega el SQL de abajo y dale "Run"');
console.log();
console.log('━'.repeat(60));
console.log(sql);
console.log('━'.repeat(60));
