// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { createMiddlewareSupabase } from '@/lib/supabase'

const PROD_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || 'nativ.com'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const host = req.headers.get('host') || ''
  const isDev = host.includes('localhost')
  const { pathname } = req.nextUrl

  // Excluir rutas de auth del middleware — deben procesarse sin interferencia
  if (pathname.startsWith('/api/auth')) {
    return res
  }

  // Refrescar sesión de Supabase Auth en cada request
  const supabase = createMiddlewareSupabase(req, res)
  const { data: { user } } = await supabase.auth.getUser()

  // ── Rutas protegidas ──────────────────────────────────────────
  const isAppRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/restaurant')

  if (isAppRoute && !user) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Si está logueado y va al login o register, redirigir al dashboard
  if ((pathname === '/login' || pathname === '/register') && user) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // ── Mini-sitio público: slug.nativ.com ────────────────────────
  if (!isDev) {
    const slug = host.split(`.${PROD_DOMAIN}`)[0]
    if (slug && slug !== 'www' && slug !== 'app' && host !== PROD_DOMAIN) {
      res.headers.set('x-tenant-slug', slug)
    }
  } else {
    const tenantSlug = req.nextUrl.searchParams.get('tenant')
    if (tenantSlug && (pathname === '/' || pathname.startsWith('/reserve'))) {
      res.headers.set('x-tenant-slug', tenantSlug)
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}