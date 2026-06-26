# CONTEXT.md — Nativ v2

## Qué es Nativ
SaaS de reservas para restaurantes independientes. El diferenciador es la invisibilidad: el widget vive dentro de la web del restaurante, sin branding de Nativ, sin marketplace.

---

## Stack
- Next.js 15 (App Router, TypeScript, Tailwind)
- Supabase (Auth + PostgreSQL) — proyecto ya creado y conectado
- Resend (emails), Twilio (SMS), Stripe (pagos), Cloudinary (imágenes)
- Vercel (deploy futuro), Vitest (tests)

---

## PROBLEMA ACTUAL — AUTH LOOP

**Síntoma:** El usuario se registra, confirma el email, hace click en el link, y vuelve al login en loop. Nunca llega a /onboarding.

**Logs del servidor:**
GET /login 200
GET /login?redirect=%2Fdashboard 200

**Lo que ya se intentó:**
1. Crear src/app/api/auth/callback/route.ts con exchangeCodeForSession
2. Excluir /api/auth/* del middleware
3. Configurar Site URL y Redirect URLs en Supabase dashboard

**El callback route actual:**
```ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/onboarding'

  if (code) {
    const supabase = await createServerSupabase()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
```

**Diagnóstico probable:** createServerSupabase usa cookies() de next/headers que no funciona correctamente en route handlers para auth callbacks. Hay que usar el patrón correcto de @supabase/ssr para route handlers.

**Recurso oficial:** https://supabase.com/docs/guides/auth/server-side/nextjs

---

## Arquitectura de URLs
- nativ.com → landing + login + register
- localhost:3000/dashboard → lista de restaurantes (dev)
- localhost:3000/restaurant/[slug]/... → panel del restaurante (dev)
- localhost:3000?tenant=slug → mini-sitio público + widget (dev)

---

## Estructura de archivos
```
src/
├── middleware.ts
├── lib/
│   ├── types.ts
│   ├── supabase.ts         — supabaseAdmin + createServerSupabase + createMiddlewareSupabase
│   ├── auth.ts             — getUser, requireUser, getTenantBySlug, getUserTenants
│   ├── tenant.ts           — resolveTenant para widget público
│   ├── email.ts, sms.ts, stripe.ts, cloudinary.ts
├── routes/
│   ├── availability.routes.ts
│   ├── reservations.routes.ts
│   └── admin.routes.ts     — usa Bearer token de Supabase Auth
└── app/
    ├── (marketing)/page.tsx, login/page.tsx, register/page.tsx
    ├── (app)/dashboard/page.tsx, onboarding/page.tsx, restaurant/[slug]/page.tsx
    ├── (public)/           — PENDIENTE
    └── api/auth/callback/route.ts, auth/logout/route.ts,
        availability/route.ts, reservations/route.ts,
        admin/route.ts, register/route.ts, upload/route.ts
```

---

## API Admin
Todos en /api/admin?resource=...
Auth: Authorization: Bearer <supabase_access_token>
Tenant: ?tenant=slug en dev

Resources: reservations, guests, shifts, areas, blocked-dates, events,
           settings, stats, employees, campaigns, birthday-config, referrals, guest-tag

---

## DB Schema
```
profiles, tenants, tenant_members, tenant_settings, tenant_photos,
seating_areas, shifts, shift_areas, blocked_dates, special_events,
guests, guest_tags, reservations, birthday_campaign_config,
ai_campaigns, referrals, employee_invites
```

---

## Estado

### Completado
- Schema DB + migrations + seed
- Todos los libs
- Todas las routes de backend
- Landing, Login, Register, Onboarding, Dashboard, Panel del restaurante
- Tests (Vitest)

### Bloqueado
- Auth callback loop (ver arriba)

### Pendiente (después de resolver auth)
- Mini-sitio público y widget de reservas (public)/
- Páginas del panel: reservations, guests, shifts, areas, events, campaigns, employees, referrals, settings
- /invite?token=xxx para empleados
- Stripe Billing
- Cron jobs (AI, birthday emails, SMS reminders)
- Superadmin panel

---

## .env.local necesario
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRICE_ID=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_DOMAIN=nativ.com
NODE_ENV=development
```

---

## Decisiones de diseño
- Supabase Auth (email/password + Google OAuth) — sin magic links propios
- Guest upsert por email con trigger para visit_count
- Áreas de seating configurables (no hardcodeado inside/outside)
- Panel admin oscuro, branding del restaurante solo en widget público
- Stripe Connect para señas — el dinero va directo al restaurante
- Bearer token en API admin