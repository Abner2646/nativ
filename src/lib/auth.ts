// src/lib/auth.ts
import { cache } from 'react'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { createServerSupabase, supabaseAdmin } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { Profile } from '@/lib/types'

// JWKS del proyecto (claves ES256 públicas). jose cachea las claves en
// module scope: tras el primer fetch, verificar un JWT no toca la red.
const JWKS = createRemoteJWKSet(
  new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
)

export interface AuthUser {
  id: string
  email: string | null
}

// Una vez por request: React cache() dedupea las llamadas de layout + page.
// El JWT se verifica localmente (firma + expiración contra JWKS); solo se
// cae a la red de Auth cuando el token está vencido, para que refresque.
export const getUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createServerSupabase()
  const { data: { session } } = await supabase.auth.getSession() // lee cookies, sin red
  if (!session?.access_token) return null
  try {
    const { payload } = await jwtVerify(session.access_token, JWKS)
    if (!payload.sub) return null
    return { id: payload.sub, email: (payload.email as string) ?? null }
  } catch {
    // Vencido o ilegible → camino lento y seguro (getUser refresca si puede)
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null
    return { id: user.id, email: user.email ?? null }
  }
})

// Obtener el usuario o redirigir al login
export async function requireUser(): Promise<AuthUser> {
  const user = await getUser()
  if (!user) redirect('/login')
  return user
}

// Obtener el perfil del usuario (cacheado por request)
export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as Profile
})

// Verificar que el usuario tiene acceso a un tenant con el rol requerido
export async function requireTenantAccess(
  userId: string,
  tenantId: string,
  requiredRole?: 'admin' | 'employee'
) {
  // Superadmin tiene acceso a todo
  const profile = await getProfile(userId)
  if (profile?.is_superadmin) return { role: 'admin' as const }

  const { data, error } = await supabaseAdmin
    .from('tenant_members')
    .select('role')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error || !data) redirect('/dashboard')

  if (requiredRole === 'admin' && data.role !== 'admin') {
    redirect('/dashboard')
  }

  return { role: data.role as 'admin' | 'employee' }
}

// Obtener todos los tenants de un usuario
export async function getUserTenants(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('tenant_members')
    .select('role, tenants(*, tenant_settings(name, logo_url, primary_color))')
    .eq('user_id', userId)
    .order('created_at')

  if (error || !data) return []
  return data
}

// Verificar que el usuario es admin de un tenant por slug (redirect si no)
export async function requireAdminForSlug(slug: string, userId: string) {
  const access = await getTenantBySlug(slug, userId)
  if (!access) redirect('/dashboard')
  if (access.role !== 'admin') redirect(`/restaurant/${slug}`)
  return access
}

// Tenant + rol en UNA query (join con membership). Cacheado por request:
// layout y page comparten el resultado. El camino de superadmin (sin
// membership) es raro y usa el fallback de 2 queries.
export const getTenantBySlug = cache(async (slug: string, userId: string) => {
  const { data } = await supabaseAdmin
    .from('tenants')
    .select('*, tenant_members!inner(role)')
    .eq('slug', slug)
    .eq('tenant_members.user_id', userId)
    .maybeSingle()

  if (data) {
    const { tenant_members, ...tenant } = data as any
    return { tenant, role: tenant_members[0].role as 'admin' | 'employee' }
  }

  // Sin membership: ¿superadmin?
  const profile = await getProfile(userId)
  if (!profile?.is_superadmin) return null

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (!tenant) return null
  return { tenant, role: 'admin' as const }
})
