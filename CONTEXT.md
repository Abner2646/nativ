# CONTEXT.md — Nativ
*Última actualización: 2026-06-26 — actualizar esta fecha cada vez que se modifique este archivo*
*Auth loop resuelto. DB migrada. Listo para continuar con las páginas del panel.*

---

## Qué es este proyecto

Nativ es un SaaS de reservas para restaurantes independientes. El diferenciador central es la **invisibilidad**: el widget vive dentro de la web del restaurante, sin branding de Nativ, sin marketplace donde el cliente vea competencia.

**Modelo de negocio:** $49/mes por restaurante, 14 días de trial gratis, sin per-cover fees.
**Estado:** MVP en desarrollo. Sin clientes pagando todavía. Primer cliente objetivo: Off The Hook Raw Bar & Grill, Astoria NY.

---

## Stack técnico

| Tecnología | Uso | Estado |
|---|---|---|
| Next.js 15 (App Router) | Framework web | ✅ Configurado |
| TypeScript | Lenguaje | ✅ Configurado |
| Tailwind CSS | Estilos | ✅ Configurado |
| Supabase Auth | Autenticación | ✅ Funcional (PKCE + cookies) |
| Supabase PostgreSQL | Base de datos | ✅ Schema aplicado |
| Resend | Emails | ✅ Configurado (modo dev con onboarding@resend.dev) |
| Twilio | SMS | ⚙️ Configurado, sin testear |
| Stripe Connect | Señas de reservas | ⚙️ Configurado, sin testear |
| Stripe Billing | Suscripciones SaaS | ⏳ Pendiente |
| Cloudinary | Imágenes | ⚙️ Configurado, sin testear |
| Vercel | Deploy | ⏳ Pendiente conectar |
| Vitest | Tests | ✅ Configurado |

---

## Entornos

| Entorno | URL | Supabase | Branch de Git |
|---|---|---|---|
| Local | http://localhost:3000 | nativ-dev project | feature/* o develop |
| Preview | vercel.app/... (auto) | nativ-dev project | develop |
| Producción | nativ.com (pendiente) | nativ-prod project (pendiente crear) | main |

**Variables de entorno:**
- `.env.local` → local (NUNCA subir a Git, está en .gitignore)
- Vercel dashboard → producción
- `.env.local.example` → template sin valores reales (sí va a Git)

**Trampas conocidas del entorno:**
- Windows convierte LF a CRLF — el .gitignore y .gitattributes lo manejan
- Si el puerto 3000 está ocupado, Next.js usa 3001
- `node_modules` se metió en git una vez y hubo que hacer `git rm -r --cached node_modules` para sacarlo

---

## Git workflow

```
feature/nombre-descriptivo
        ↓ merge
     develop          → Vercel preview automático
        ↓ merge (cuando develop está estable)
       main           → Vercel producción automático
```

**Convención de commits:**
```
feat: nueva funcionalidad
fix: corrección de bug
chore: configuración, dependencias
refactor: cambio de código sin cambio de comportamiento
docs: solo documentación
test: agregar o modificar tests
```

**Branches activos actualmente:**
- `main` — estado inicial del proyecto
- `develop` — igual que main por ahora
- `feature/auth-fix` — fix del auth loop (listo para mergear a develop)

---

## Arquitectura multi-tenant

**En desarrollo:** `?tenant=slug` en la URL simula el subdominio
**En producción:** wildcard DNS `*.nativ.com` → Vercel → middleware resuelve tenant

```
nativ.com              → landing + login + register
localhost:3000/dashboard    → panel (dev)
localhost:3000/restaurant/[slug]  → panel del restaurante (dev)
localhost:3000?tenant=slug  → mini-sitio público + widget (dev)
```

**El middleware** (`src/middleware.ts`) maneja:
1. Refresh de sesión de Supabase en cada request
2. Protección de rutas (redirige a /login si no hay sesión)
3. Detección del tenant desde el subdominio o ?tenant= param

---

## Estado de cada archivo/módulo

### ✅ Completo y funcional

**`src/lib/types.ts`** — Todos los tipos TypeScript. No tocar salvo que cambie el schema.

**`src/lib/supabase.ts`** — Cuatro clientes:
- `supabaseAdmin` → service role, solo server-side
- `createServerSupabase()` → con cookies de sesión, para server components
- `createRouteHandlerSupabase(req, res)` → para route handlers (escribe cookies en el response)
- `createMiddlewareSupabase(req, res)` → para el middleware

**`src/lib/supabase-browser.ts`** — `getBrowserSupabase()` usando `createBrowserClient` de `@supabase/ssr`. Guarda sesión en cookies (no localStorage) para que el server la pueda leer.

**`src/lib/tenant.ts`** — Resolver de tenant para el widget público. Usa `?tenant=` en dev.

**`src/lib/email.ts`** — Todos los emails via Resend. En dev usa `onboarding@resend.dev` como FROM.

**`src/lib/sms.ts`** — SMS via Twilio. Sin testear en producción todavía.

**`src/lib/stripe.ts`** — Helpers de Stripe Connect y Billing. Sin testear.

**`src/lib/cloudinary.ts`** — Upload y delete de imágenes. Sin testear.

**`src/routes/availability.routes.ts`** — Lógica de disponibilidad con áreas configurables. Testeada.

**`src/routes/reservations.routes.ts`** — Crear y cancelar reservas con upsert de guest. Testeada.

**`src/routes/admin.routes.ts`** — Todos los endpoints admin. Auth via Bearer token de Supabase. Testeada parcialmente.

**`src/app/api/*/route.ts`** — Wrappers de Next.js. Solo despachan a los routes files.

**`src/app/(marketing)/page.tsx`** — Landing minimalista. Completa.

**`src/app/(app)/dashboard/page.tsx`** — Lista de restaurantes del usuario. Completa.

**`src/app/(app)/restaurant/[slug]/page.tsx`** — Dashboard del restaurante con stats. Completa.

**`supabase/migrations/001_schema.sql`** — Schema completo aplicado en Supabase dev.

**`supabase/seed.sql`** — Seed aplicado. Tenant `offthehook` con shifts, áreas y blocked dates.

**`tests/api.test.ts`** — Tests de todos los endpoints. Los autenticados requieren `ACCESS_TOKEN` env var.

### ✅ Resuelto en esta sesión

**`src/app/api/auth/callback/route.ts`** — Usa `createRouteHandlerSupabase` para escribir las cookies de sesión directamente en el redirect response. Flujo PKCE correcto.

**`src/app/api/auth/logout/route.ts`** — Actualizado al mismo patrón.

**`src/middleware.ts`** — Funciona correctamente. Protege rutas y refresca sesión.

**`src/lib/auth.ts`** — Funcional. `requireUser()` redirige a /login si no hay sesión.

**`src/app/(marketing)/login/page.tsx`** — Migrado a `getBrowserSupabase()`. Incluye `onAuthStateChange` para manejar tokens en el hash (flujo implícito).

**`src/app/(marketing)/register/page.tsx`** — Migrado a `getBrowserSupabase()`.

**`src/app/(app)/onboarding/page.tsx`** — Migrado a `getBrowserSupabase()`.

### ⏳ Pendiente (stub vacío o inexistente)

- `src/app/(public)/page.tsx` — Mini-sitio público del restaurante
- `src/app/(public)/reserve/page.tsx` — Widget de reservas
- `src/app/(app)/restaurant/[slug]/reservations/page.tsx`
- `src/app/(app)/restaurant/[slug]/guests/page.tsx`
- `src/app/(app)/restaurant/[slug]/shifts/page.tsx`
- `src/app/(app)/restaurant/[slug]/areas/page.tsx`
- `src/app/(app)/restaurant/[slug]/events/page.tsx`
- `src/app/(app)/restaurant/[slug]/campaigns/page.tsx`
- `src/app/(app)/restaurant/[slug]/employees/page.tsx`
- `src/app/(app)/restaurant/[slug]/referrals/page.tsx`
- `src/app/(app)/restaurant/[slug]/settings/page.tsx`
- `/invite?token=xxx` — Aceptar invitación de empleado
- Stripe Billing (suscripciones automáticas)
- Cron jobs (AI campaigns, birthday emails, SMS reminders 24hs antes)
- Superadmin panel

---

## 🔴 BLOQUEADORES ACTIVOS

*Ninguno actualmente.*

---

## Schema de base de datos

**Tablas y su propósito:**

| Tabla | Propósito |
|---|---|
| `profiles` | Extiende auth.users. Tiene `is_superadmin`. Se crea automáticamente con trigger. |
| `tenants` | Restaurantes. Tiene `slug`, `status` (trial/active/inactive), `trial_ends_at`. |
| `tenant_members` | Relación user ↔ tenant con rol (admin/employee). Un user puede tener múltiples tenants. |
| `tenant_settings` | Branding (colores, fuente, logo), info del restaurante, config operativa. Una fila por tenant. |
| `tenant_photos` | Galería de fotos del mini-sitio. URL de Cloudinary + position. |
| `seating_areas` | Áreas configurables (reemplaza inside/outside hardcodeado). Nombre libre. |
| `shifts` | Turnos por día de semana (0=Dom, 6=Sáb). Nombre libre, horarios, duración. |
| `shift_areas` | Capacidad de cada área por shift. Join table entre shifts y seating_areas. |
| `blocked_dates` | Fechas en que el restaurante no acepta reservas. |
| `special_events` | Fechas con seña obligatoria (ej: San Valentín). Monto y política de reembolso. |
| `guests` | Clientes. Upsert por email dentro del tenant. `visit_count` se actualiza con trigger cuando una reserva pasa a `completed`. |
| `guest_tags` | Tags personalizados por cliente (ej: "VIP"). Asociados al guest, aplican a todas sus reservas. |
| `reservations` | Reservas. Tiene `cancellation_token` UUID para cancelar sin auth. |
| `birthday_campaign_config` | Config del email de cumpleaños por tenant. Cuerpo editable con variables. |
| `ai_campaigns` | Campañas sugeridas por IA. El admin las aprueba/rechaza antes de enviar. |
| `referrals` | Sistema de referidos. 3 meses al 50% para ambas partes. |
| `employee_invites` | Invitaciones pendientes de empleados. Token de 7 días. |

**Seed de desarrollo:**
- Tenant: `offthehook` (Off The Hook Raw Bar & Grill)
- Áreas: Main dining room, Outdoor patio
- Shifts: mar-jue cena, vie-sáb almuerzo+cena, dom almuerzo, lun cerrado
- Blocked dates: 25 dic, 1 ene, 4 jul

---

## API

**Endpoints públicos (sin auth):**
```
GET  /api/availability?date=YYYY-MM-DD&party_size=N&tenant=slug
POST /api/reservations?tenant=slug
POST /api/reservations?action=cancel&tenant=slug
```

**Endpoints admin (requieren Bearer token):**
```
GET/POST/PATCH/DELETE /api/admin?resource=RESOURCE&tenant=slug
```

Resources disponibles:
- GET: `reservations`, `guests`, `shifts`, `areas`, `blocked-dates`, `events`, `settings`, `stats`, `employees`, `campaigns`, `birthday-config`, `referrals`
- POST: `shifts`, `areas`, `blocked-dates`, `events`, `employees` (invite), `guest-tag`
- PATCH: `reservations`, `guests`, `shifts`, `areas`, `settings`, `campaigns`, `birthday-config`
- DELETE: `shifts`, `areas`, `blocked-dates`, `events`, `employees`, `guest-tag`

**Cómo obtener el Bearer token para tests:**
DevTools → Application → Local Storage → `sb-[project-ref]-auth-token` → copiar `access_token`

---

## Decisiones de diseño (y por qué)

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Supabase Auth en vez de magic links propios | Magic links propios (se usó en OTH) | Un SaaS necesita auth estándar, Google OAuth, recovery de contraseña |
| Un solo plan ($49/mes) | Múltiples planes | Simplifica el MVP, se agrega después con data de clientes reales |
| `tenant_members` many-to-many | user pertenece a un solo tenant | Un usuario puede tener múltiples restaurantes |
| Áreas configurables en vez de inside/outside | inside/outside hardcodeado | Restaurantes con pisos, sectores, bar no encajan en solo dos áreas |
| Panel en `app.nativ.com` en vez de `slug.nativ.com/admin` | Subdominio del restaurante | Cookies de sesión de Supabase no cruzan subdominios fácilmente |
| Stripe Connect para señas | Procesar pagos y transferir | El dinero va directo al restaurante, Nativ no toca la plata |
| Bearer token en API admin | x-auth-token custom | Reusar el token de Supabase Auth, menos complejidad |