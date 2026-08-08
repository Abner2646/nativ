# CLAUDE.md — Nativ

## VERIFICACIÓN DE DIRECTORIO — LEER PRIMERO

**Claude debe iniciarse desde `nativ (2)/nativ2/`**, no desde el Desktop ni desde `nativ (2)/`.

Al arrancar, verificá el directorio de trabajo con:
```
git rev-parse --show-toplevel
```

El resultado correcto es una ruta que termina en `.../nativ (2)/nativ2`.

**Si el resultado es `C:/Users/Abner/Desktop` o cualquier otra ruta → ALERTAR en cada respuesta con:**

> ⚠️ **Claude está corriendo desde el directorio incorrecto.** El repositorio activo es el del Desktop, no el del proyecto. Cerrá esta sesión y reabrí Claude Code desde la carpeta `nativ (2)/nativ2/`. De lo contrario los comandos de git y los paths van a estar mal.

---

## Proyecto

Nativ es un SaaS de reservas para restaurantes independientes. El diferenciador es la invisibilidad: el widget vive dentro de la web del restaurante sin branding de Nativ.

Leé `CONTEXT.md` para el estado completo del proyecto antes de empezar cualquier tarea.

---

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase (Auth + PostgreSQL) · Resend · Twilio · Stripe Connect + Billing · Cloudinary · Vercel · Vitest

---

## Git workflow

```
feature/nombre-descriptivo → develop → main
```

- `main` → deploy automático a producción (nativ.com)
- `develop` → preview en Vercel

**Convención de commits:**
```
feat:     nueva funcionalidad
fix:      corrección de bug
chore:    configuración, dependencias
refactor: cambio sin cambio de comportamiento
perf:     mejora de performance
docs:     solo documentación
test:     agregar o modificar tests
```

---

## Reglas del proyecto

- Nunca subir `.env.local` a git — las variables reales van en Vercel dashboard
- Los tests unitarios gatan deploys en Vercel (`vercel.json` → `buildCommand: "npm run test && next build"`)
- Un solo proyecto de Supabase para prod y dev — tener cuidado con migraciones destructivas
- Siempre actualizar `CONTEXT.md` cuando se completa un módulo o cambia el estado del proyecto
- Windows puede convertir LF a CRLF — `.gitattributes` lo maneja, no forzar cambios de line ending

---

## Comandos frecuentes

```bash
npm run dev          # servidor local en :3000
npm test             # tests unitarios (Vitest)
npm run build        # build de producción local
```

**Supabase local:**
```bash
npx supabase db push          # aplicar migraciones pendientes
npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
```

---

## Archivos clave

| Archivo | Qué hace |
|---|---|
| `CONTEXT.md` | Estado completo del proyecto — leer antes de cualquier tarea |
| `src/middleware.ts` | Protección de rutas, refresh de sesión, resolución de tenant |
| `src/lib/supabase.ts` | Cuatro clientes de Supabase |
| `src/lib/auth.ts` | `requireUser()`, `requireAdminForSlug()`, `requireSuperadmin()` |
| `src/lib/types.ts` | Todos los tipos TypeScript del proyecto |
| `src/lib/domain.ts` | Construcción de URLs sin hardcodear dominio |
| `vercel.json` | Cron jobs y build command con tests |
| `supabase/migrations/` | Migraciones de DB en orden numérico |
