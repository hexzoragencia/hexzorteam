# Hexzor Empresarial

Panel de gestión integral para VASECOM. Reemplaza el flujo manual de `AURA.xlsx` con una web app multiusuario que se instala como app en el celular (PWA).

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind
- **Supabase** (auth + Postgres + realtime) — free tier
- **Vercel** — hosting gratis

---

## Setup completo (paso a paso)

### 1. Instalar Node.js (sólo la primera vez)

Como no tienes Homebrew instalado, lo más rápido es bajarlo del sitio oficial:

1. Abre https://nodejs.org en tu navegador
2. Descarga la versión **LTS** (botón verde grande "Recommended for most users")
3. Abre el `.pkg` descargado y dale "Continue → Install" (pide tu contraseña Mac)
4. Verifica abriendo Terminal y escribiendo: `node --version` (debe mostrar algo como `v20.18.0`)

### 2. Crear cuentas (todas gratis)

| Cuenta | URL | Para qué |
|---|---|---|
| GitHub | https://github.com/signup | Guardar el código |
| Supabase | https://supabase.com/dashboard/sign-up | Base de datos + login |
| Vercel | https://vercel.com/signup | Hosting (entra con GitHub) |

### 3. Crear el proyecto en Supabase

1. Entra a https://supabase.com/dashboard → **New project**
2. Nombre: `hexzor-empresarial` · Región: **South America (São Paulo)** o la más cercana
3. Genera una contraseña fuerte para la BD y guárdala
4. Espera ~2 min mientras se aprovisiona

5. **Cargar el esquema:** En tu nuevo proyecto, ve a **SQL Editor → New query**, copia y pega TODO el contenido de [`lib/supabase/schema.sql`](lib/supabase/schema.sql) y dale **Run**.

6. **Desactivar confirmación por email** (más cómodo en desarrollo): **Authentication → Providers → Email → Confirm email = OFF → Save**.

7. **Copiar tus credenciales:** **Project Settings → API**
   - Copia `Project URL` (tipo `https://xxxxx.supabase.co`)
   - Copia `anon public` key (un string largo `eyJhbGc...`)

### 4. Configurar el proyecto local

```bash
cd ~/Downloads/hexzor-empresarial

# Crear archivo de variables de entorno
cp .env.local.example .env.local
```

Abre `.env.local` con TextEdit y pega tus dos valores de Supabase.

```bash
# Instalar dependencias (toma 1-2 min)
npm install

# Arrancar servidor de desarrollo
npm run dev
```

Abre http://localhost:3000 → te redirige a `/login` → dale **Regístrate** y crea tu cuenta + la de Miguel.

### 5. Subir a GitHub + Vercel (deploy)

```bash
cd ~/Downloads/hexzor-empresarial
git init
git add .
git commit -m "Hexzor Empresarial v1"
```

1. En GitHub crea un repo nuevo llamado `hexzor-empresarial` (privado).
2. Sigue las instrucciones que te muestra GitHub para `git remote add origin ...` y `git push`.
3. En Vercel: **Add New → Project → Import** tu repo.
4. En **Environment Variables** agrega `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (los mismos del `.env.local`).
5. **Deploy** → te dará una URL `https://hexzor-empresarial.vercel.app`.

### 6. Instalar como app en el celular (PWA)

- **iPhone (Safari):** abre la URL → botón compartir → "Añadir a pantalla de inicio"
- **Android (Chrome):** abre la URL → menú ⋮ → "Añadir a pantalla de inicio"

---

## Lo que ya funciona (Fase 1)

- ✅ Login + registro multiusuario (Victor + Miguel)
- ✅ Dashboard con capital actual, ingresos/gastos del mes, utilidad y **alertas automáticas** (capital bajo, gastos > ingresos, etc.)
- ✅ Registro de movimientos (gasto diario / fijo / ingreso / inyección capital) con categorías predefinidas
- ✅ Calculadora multipaís: escribe precio proveedor → te da PV, utilidad, comparación y desglose completo
- ✅ Configuración: editar % entrega, CPA objetivo, utilidad, flete por país desde la web
- ✅ PWA — se instala como app en celular

## Próximas fases

- **Fase 2:** Productos + Campañas ADS (CPA/ROI auto-calculados)
- **Fase 3:** Páginas ganadoras + Proyecciones + Alertas con IA + Reportes mensuales

---

## Estructura del proyecto

```
hexzor-empresarial/
├── app/
│   ├── (auth)/login, register   # Pantallas públicas
│   ├── (app)/                    # Pantallas protegidas
│   │   ├── page.tsx              # Dashboard
│   │   ├── movimientos/
│   │   ├── calculadora/
│   │   └── configuracion/
│   └── auth/callback             # OAuth callback Supabase
├── components/ui/                # shadcn primitives
├── components/nav.tsx            # Sidebar/drawer
├── lib/
│   ├── calc.ts                   # Lógica calculadora
│   ├── types.ts
│   └── supabase/
│       ├── client.ts             # Cliente browser
│       ├── server.ts             # Cliente server
│       ├── middleware.ts         # Auth middleware
│       └── schema.sql            # ⭐ Pegar en Supabase SQL Editor
└── middleware.ts                 # Protección de rutas
```
