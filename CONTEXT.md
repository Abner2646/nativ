# CONTEXT.md — Nativ
*Última actualización: 2026-07-22 — actualizar esta fecha cada vez que se modifique este archivo*
*Superadmin panel completo. Birthday cron implementado. Pendiente: AI campaigns auto-gen.*

---

## Qué es este proyecto

Nativ es un SaaS de reservas para restaurantes independientes. El diferenciador central es la **invisibilidad**: el widget vive dentro de la web del restaurante, sin branding de Nativ, sin marketplace donde el cliente vea competencia.

**Modelo de negocio:** $49/mes por restaurante, 14 días de trial gratis, sin per-cover fees.
**Estado:** MVP completo en desarrollo. Sin clientes pagando todavía. Primer cliente objetivo: Off The Hook Raw Bar & Grill, Astoria NY.

---

## Stack técnico

| Tecnología | Uso | Estado |
|---|---|---|
| Next.js 15 (App Router) | Framework web | ✅ Configurado |
| TypeScript | Lenguaje | ✅ Configurado |
| Tailwind CSS | Estilos | ✅ Configurado |
| Supabase Auth | Autenticación | ✅ Funcional (PKCE + cookies) |
| Supabase PostgreSQL | Base de datos | ✅ 13 migraciones aplicadas |
| Resend | Emails | ✅ Configurado (modo dev con onboarding@resend.dev) |
| Twilio | SMS | ✅ Implementado — Toll-Free Verification TFV-30484 en proceso |
| Stripe Connect | Señas de reservas | ✅ Implementado — sin testear en producción |
| Stripe Billing | Suscripciones SaaS | ✅ Implementado — sin testear en producción |
| Cloudinary | Imágenes | ✅ Implementado — usado en fotos del mini-sitio |
| Vercel | Deploy | ✅ En producción |
| Vitest | Tests | ✅ Tests unitarios gating deploys en Vercel |

---

## Entornos

| Entorno | URL | Supabase | Branch de Git |
|---|---|---|---|
| Local | http://localhost:3000 | mismo proyecto que prod | feature/* o develop |
| Preview | vercel.app/... (auto) | mismo proyecto que prod | develop |
| Producción | nativ.com | proyecto único de Supabase (prod y dev comparten DB) | main |

**Variables de entorno:**
- `.env.local` → local (NUNCA subir a Git, está en .gitignore)
- Vercel dashboard → producción
- `.env.local.example` → template sin valores reales (sí va a Git)

**Trampas conocidas del entorno:**
- Windows convierte LF a CRLF — el .gitignore y .gitattributes lo manejan
- Si el puerto 3000 está ocupado, Next.js usa 3001
- `node_modules` se metió en git una vez y hubo que hacer `git rm -r --cached node_modules` para sacarlo
- `tsconfig.tsbuildinfo` se ignora via `.gitignore` (artefacto de build incremental)

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
perf: mejora de performance sin cambio de comportamiento
docs: solo documentación
test: agregar o modificar tests
```

**Branches locales activos (sin commits nuevos respecto a main):**
- `feat/admin-new-reservation`, `feat/embed-script`, `feat/embed-share`
- `feat/sidebar-isotipo-redirect`, `fix/public-page-visibility`
- `fix/register-empty-error`, `fix/remove-hardcoded-domain`
- Todos ya mergeados → candidatos a borrar

---

## Arquitectura multi-tenant

**En desarrollo:** `?tenant=slug` en la URL simula el subdominio
**En producción:** wildcard DNS `*.nativ.com` → Vercel → middleware resuelve tenant

```
nativ.com                          → landing + login + register
localhost:3000/dashboard           → lista de restaurantes del usuario
localhost:3000/restaurant/[slug]   → dashboard del restaurante
localhost:3000/reserve?tenant=slug → widget de reservas público
localhost:3000/floor-plan/[slug]   → vista de servicio (empleados)
```

**El middleware** (`src/middleware.ts`) maneja:
1. Refresh de sesión de Supabase en cada request
2. Protección de rutas (redirige a /login si no hay sesión)
3. Detección del tenant desde el subdominio real o `?tenant=` param (solo dev)
4. Solo extrae tenant de subdominios reales de nativ.com — no de cualquier subdominio

---

## Estado de cada archivo/módulo

### ✅ Infraestructura y auth

**`src/lib/supabase.ts`** — Cuatro clientes: `supabaseAdmin`, `createServerSupabase()`, `createRouteHandlerSupabase(req, res)`, `createMiddlewareSupabase(req, res)`.

**`src/lib/supabase-browser.ts`** — `getBrowserSupabase()` usando `createBrowserClient` de `@supabase/ssr`. Cookies (no localStorage) para que el server lea la sesión.

**`src/lib/auth.ts`** — `requireUser()` redirige a /login. `requireAdminForSlug()` valida pertenencia al tenant y rol. `getTenantBySlug()` para empleados (no requiere admin).

**`src/lib/types.ts`** — Todos los tipos TypeScript. Incluye `DepositRule`, `RestaurantTable`, `TableCombination`, `WaitlistEntry` y más.

**`src/middleware.ts`** — Funcional. Protege rutas, refresca sesión, resuelve tenant.

**`src/lib/domain.ts`** — Helper para construir URLs sin hardcodear el dominio. Usa `NEXT_PUBLIC_APP_URL`.

**`src/lib/ratelimit.ts`** — Rate limiting en memoria para endpoints públicos.

### ✅ Servicios externos

**`src/lib/email.ts`** — Emails via Resend. En dev usa `onboarding@resend.dev` como FROM. Templates: confirmación de reserva, cancelación, reminder, cumpleaños, invitación de empleado.

**`src/lib/sms.ts`** — SMS via Twilio. `sendReminderSMS()` implementado.

**`src/lib/stripe.ts`** — Helpers de Stripe Connect (cuentas de restaurantes) y Billing (suscripciones). `addCouponToSubscription()` para referidos.

**`src/lib/cloudinary.ts`** — Upload y delete de imágenes. Usado en `/photos`.

**`src/lib/phone.ts`** — Formateo de números de teléfono.

**`src/lib/theme.ts`** — Construye el objeto de tema del widget público desde `tenant_settings` (colores, fuente).

**`src/lib/turn-times.ts`** — Lógica de turn times para el floor plan. Testeada con unit tests.

### ✅ API endpoints

**Públicos (sin auth):**
```
GET  /api/availability?date=YYYY-MM-DD&party_size=N&tenant=slug
POST /api/reservations?tenant=slug
POST /api/reservations?action=cancel&tenant=slug
GET  /api/deposit?reservation_id=xxx        ← seña pendiente
```

**Auth (Bearer token de Supabase):**
```
GET/POST/PATCH/DELETE /api/admin?resource=RESOURCE&tenant=slug
POST /api/invite        ← acepta invitación de empleado
POST /api/referral/apply
POST /api/upload        ← Cloudinary upload
```

**Billing:**
```
POST /api/billing/checkout   ← crea sesión de Stripe Checkout
POST /api/billing/portal     ← crea sesión del Customer Portal
POST /api/billing/webhook    ← webhook de Stripe (firma verificada)
```

**Cron (protegido por CRON_SECRET):**
```
GET /api/cron/reminders      ← reminders 24h antes — corre 10:00 UTC diario (vercel.json)
```

**Resources admin disponibles:**
- GET: `reservations`, `guests`, `shifts`, `areas`, `blocked-dates`, `events`, `settings`, `stats`, `employees`, `campaigns`, `birthday-config`, `referrals`, `tables`, `waitlist`
- POST: `shifts`, `areas`, `blocked-dates`, `events`, `employees`, `guest-tag`, `tables`, `waitlist`
- PATCH: `reservations`, `guests`, `shifts`, `areas`, `settings`, `campaigns`, `birthday-config`, `tables`
- DELETE: `shifts`, `areas`, `blocked-dates`, `events`, `employees`, `guest-tag`, `tables`, `waitlist`

### ✅ Páginas de marketing

**`src/app/(marketing)/page.tsx`** — Landing completa siguiendo Brand OS. Métricas strip, demo en vivo de reserva, mission statement.

**`src/app/(marketing)/login/page.tsx`** — Con `getBrowserSupabase()` y `onAuthStateChange`.

**`src/app/(marketing)/register/page.tsx`** — Con `getBrowserSupabase()`.

**`src/app/(marketing)/forgot-password/page.tsx`** — Solicita reset por email.

**`src/app/(marketing)/reset-password/page.tsx`** — Formulario de nueva contraseña con token de Supabase.

**`src/app/(marketing)/privacy/page.tsx`** — Política de privacidad. Menciona nombre legal del operador (requerido por Twilio TFV).

**`src/app/(marketing)/terms/page.tsx`** — Términos y condiciones con SMS opt-in. Cumple checklist Twilio Web Form.

### ✅ Páginas del panel (app)

**`src/app/(app)/dashboard/page.tsx`** — "Business Pulse": lista de restaurantes con stats rápidas (reservas hoy, esta semana). Redesigned.

**`src/app/(app)/onboarding/page.tsx`** — Crea el tenant inicial. Migrado a `getBrowserSupabase()`. Tiene botón de salida.

**`src/app/(app)/account/page.tsx`** — Perfil del usuario, cambio de contraseña.

**`src/app/(app)/restaurant/[slug]/page.tsx`** — Dashboard del restaurante con stats.

**`src/app/(app)/restaurant/[slug]/reservations/page.tsx`** — Lista con filtros de fecha y estado. Acciones de cancelar/completar. Cards en mobile, tabla en desktop. Modal para crear nueva reserva. Editar/reagendar implementado.

**`src/app/(app)/restaurant/[slug]/guests/page.tsx`** — Lista de guests con tags. Split view en tablet/desktop. Cards en mobile.

**`src/app/(app)/restaurant/[slug]/floor-plan/page.tsx`** — Vista completa: editor drag & drop de mesas (admin), vista de servicio en tiempo real (empleados), timeline, turn times, combinación de mesas, waitlist, mobile bottom sheet. Hidrata con data del server para evitar loading doble.

**`src/app/(app)/restaurant/[slug]/shifts/page.tsx`** — CRUD de turnos por día de semana.

**`src/app/(app)/restaurant/[slug]/areas/page.tsx`** — CRUD de áreas de asientos configurables.

**`src/app/(app)/restaurant/[slug]/events/page.tsx`** — Fechas especiales con seña obligatoria.

**`src/app/(app)/restaurant/[slug]/campaigns/page.tsx`** — Campañas de IA (listado + aprobación/rechazo) + config de email de cumpleaños.

**`src/app/(app)/restaurant/[slug]/employees/page.tsx`** — Invitar empleados, listar miembros, desactivar. Aterrizan en `/floor-plan` por defecto.

**`src/app/(app)/restaurant/[slug]/referrals/page.tsx`** — Código de referido, estado de los referidos generados.

**`src/app/(app)/restaurant/[slug]/billing/page.tsx`** — Plan actual, estado de trial, botón de upgrade (Stripe Checkout) y portal de billing. Sin testear en producción.

**`src/app/(app)/restaurant/[slug]/deposits/page.tsx`** — Reglas de depósito/seña. Requiere Stripe Connect activo.

**`src/app/(app)/restaurant/[slug]/photos/page.tsx`** — Galería del mini-sitio. Upload via Cloudinary.

**`src/app/(app)/restaurant/[slug]/embed/page.tsx`** — Instrucciones y script de embed del widget.

**`src/app/(app)/restaurant/[slug]/settings/page.tsx`** — Branding, info del restaurante, config operativa.

**`src/app/(app)/restaurant/[slug]/more/page.tsx`** — Hub de navegación en mobile para páginas secundarias.

### ✅ Cron — birthdays

**`src/app/api/cron/birthdays/route.ts`** — Corre diario a las 10:00 UTC. Protegido por `CRON_SECRET`. Para cada tenant con `birthday_campaign_config.is_enabled = true`, busca guests cuyo cumpleaños sea en exactamente `days_before` días. **Guarda de "nuevo en el sistema"**: solo envía a guests cuyo `created_at` sea anterior a la apertura de la ventana (`days_before` días atrás) — evita mandar emails de cumpleaños a alguien que acaba de reservar y cuyo cumpleaños coincide con el window.

### ✅ Páginas públicas

**`src/app/reserve/page.tsx`** — Widget de reservas con tema custom del tenant. Hidrata con data del server.

**`src/app/invite/page.tsx`** — Acepta invitación de empleado por token.

**`src/app/cancel/page.tsx`** — Cancela reserva via `cancellation_token` (sin auth requerida).

### ✅ Embed

**Self-injecting JS widget** — `feat/embed-script` mergeado. El script se inyecta en la web del restaurante sin iframe. Página `/embed` con instrucciones en el panel.

### ✅ Tests

**`tests/api.test.ts`** — Tests de endpoints de API. Autenticados requieren `ACCESS_TOKEN` env var.

**`src/components/admin/__tests__/`** — Tests unitarios de componentes.

**`src/lib/__tests__/phone.test.ts`** — Tests de formateo de teléfono.

**`src/lib/__tests__/turn-times.test.ts`** — Tests de lógica de turn times.

**`vercel.json`** — `buildCommand: "npm run test && next build"` → los tests unitarios gatan deploys.

### ✅ Superadmin panel (`/superadmin`)

**`src/app/superadmin/layout.tsx`** — Layout con nav (Overview / Tenants / Users). Gateado por `requireSuperadmin()` — redirige a `/dashboard` si no es superadmin. Middleware también protege la ruta.

**`src/app/superadmin/page.tsx`** — Dashboard con MRR, conteos por estado, trials expirando en 7 días, y signups de últimos 30 días.

**`src/app/superadmin/tenants/page.tsx`** — Tabla de todos los tenants con filtro por estado, búsqueda por nombre/slug, y countdown coloreado del trial.

**`src/app/superadmin/tenants/[id]/page.tsx`** — Detalle del tenant: settings, miembros, stats de reservas/guests, acciones.

**`src/app/superadmin/tenants/[id]/TenantActionsClient.tsx`** — Acciones inline: activate, deactivate, start trial, extend trial +14d.

**`src/app/superadmin/users/page.tsx`** — Todos los usuarios con toggle de superadmin.

**`src/app/api/superadmin/tenant/route.ts`** — `POST /api/superadmin/tenant?id=&action=` — acciones: `activate`, `deactivate`, `start_trial`, `extend_trial`. Verifica `is_superadmin` server-side.

**`src/app/api/superadmin/user/route.ts`** — `POST /api/superadmin/user?id=&action=toggle_superadmin`. Impide auto-revocación.

**Dashboard** — Muestra badge "Superadmin" → `/superadmin` solo a usuarios con `is_superadmin: true`.

### ⏳ Pendiente

- **AI campaigns auto-generación** — Las campañas existen en DB y se muestran en el panel, pero no hay generación automática via IA. Actualmente solo se aprueban/rechazan las que se creen manualmente.
- **Stripe producción** — Billing y depósitos implementados pero nunca testeados end-to-end en producción.

---

## 🔴 BLOQUEADORES ACTIVOS

*Ninguno actualmente.*

---

## Schema de base de datos

**Migraciones aplicadas:** 13 (`001` → `013`)

**Tablas principales:**

| Tabla | Propósito |
|---|---|
| `profiles` | Extiende auth.users. Tiene `is_superadmin`. Trigger automático. |
| `tenants` | Restaurantes. `slug`, `status` (trial/active/inactive), `trial_ends_at`, `stripe_customer_id`, `stripe_subscription_id`. |
| `tenant_members` | user ↔ tenant con rol (admin/employee). |
| `tenant_settings` | Branding, info, config operativa, `stripe_account_id`, `timezone`. |
| `tenant_photos` | Galería del mini-sitio (Cloudinary). |
| `seating_areas` | Áreas configurables (`is_active`, `position`). |
| `shifts` | Turnos por día de semana. |
| `shift_areas` | Capacidad por área por shift. |
| `blocked_dates` | Fechas sin reservas. |
| `special_events` | Señas obligatorias (ej: San Valentín). |
| `restaurant_tables` | Mesas físicas para el floor plan (número, capacidad, posición x/y, shape). |
| `table_assignments` | Qué mesa tiene cada reserva. |
| `table_combinations` | Combinación de mesas. |
| `guests` | Clientes. Upsert por email. `visit_count` via trigger. |
| `guest_tags` | Tags por cliente. |
| `reservations` | Reservas. `cancellation_token`, `reschedule_count`, `source`. |
| `deposit_rules` | Reglas de seña por tipo/evento. |
| `waitlist` | Lista de espera por fecha/turno. |
| `birthday_campaign_config` | Config de email de cumpleaños por tenant. |
| `ai_campaigns` | Campañas sugeridas por IA. Aprobación manual antes de enviar. |
| `referrals` | Sistema de referidos. 3 meses al 50% para ambas partes. |
| `employee_invites` | Invitaciones pendientes. Token de 7 días. |

**Seed de desarrollo:**
- Tenant: `offthehook` (Off The Hook Raw Bar & Grill)
- Áreas: Main dining room, Outdoor patio
- Shifts: mar-jue cena, vie-sáb almuerzo+cena, dom almuerzo, lun cerrado
- Blocked dates: 25 dic, 1 ene, 4 jul

---

## Decisiones de diseño

| Decisión | Alternativa descartada | Razón |
|---|---|---|
| Supabase Auth | Magic links propios | Un SaaS necesita auth estándar, Google OAuth, recovery |
| Un solo plan ($49/mes) | Múltiples planes | Simplifica el MVP |
| `tenant_members` many-to-many | user pertenece a un solo tenant | Un usuario puede tener múltiples restaurantes |
| Áreas configurables | inside/outside hardcodeado | Restaurantes con pisos, sectores, bar |
| Panel en `app.nativ.com` | `slug.nativ.com/admin` | Cookies de sesión no cruzan subdominios |
| Stripe Connect para señas | Procesar y transferir | El dinero va directo al restaurante |
| Bearer token en API admin | x-auth-token custom | Reusar el token de Supabase Auth |
| JS embed script | iframe | Más flexible, sin restricciones de iframe, se integra con el DOM del restaurante |
| Empleados aterrizan en floor-plan | Dashboard de stats | Los empleados usan el floor plan en servicio, no ven stats de negocio |
| Tests unitarios gatan deploys | Tests opcionales | Un test fallido en Vercel bloqueó un deploy — se formalizó como requisito |
| Self-hosted turn times | Configuración por turno | La lógica de turn times es compleja; `src/lib/turn-times.ts` centraliza y testea |
| `NEXT_PUBLIC_APP_URL` para dominios | Hardcoded string | TFV de Twilio requería consistencia — `domain.ts` centraliza la construcción de URLs |
