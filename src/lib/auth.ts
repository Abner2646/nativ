// src/lib/auth.ts
import { createServerSupabase, supabaseAdmin } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { Profile } from '@/lib/types'

// Obtener el usuario autenticado desde server component
export async function getUser() {
  const supabase = await createServerSupabase()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

// Obtener el usuario o redirigir al login
export async function requireUser() {
  const user = await getUser()
  if (!user) redirect('/login')
  return user
}

// Obtener el perfil del usuario
export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as Profile
}

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

// Obtener un tenant por slug verificando acceso del usuario
export async function getTenantBySlug(slug: string, userId: string) {
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (!tenant) return null

  // Verificar acceso
  const profile = await getProfile(userId)
  if (!profile?.is_superadmin) {
    const { data: member } = await supabaseAdmin
      .from('tenant_members')
      .select('role')
      .eq('user_id', userId)
      .eq('tenant_id', tenant.id)
      .maybeSingle()

    if (!member) return null
    return { tenant, role: member.role as 'admin' | 'employee' }
  }

  return { tenant, role: 'admin' as const }
}
