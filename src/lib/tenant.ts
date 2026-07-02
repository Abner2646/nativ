// src/lib/tenant.ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { TenantContext } from '@/lib/types'
import { getAppDomain } from '@/lib/domain'

export function getTenantSlug(req: NextRequest): string | null {
  const host = req.headers.get('host') || ''
  const domain = getAppDomain()

  // Subdomain routing: only when a custom domain is configured and the host has it as suffix
  if (domain && host.endsWith(`.${domain}`)) {
    const slug = host.slice(0, host.length - domain.length - 1)
    if (slug && slug !== 'www' && slug !== 'app') return slug
  }

  // All other cases (localhost, Vercel preview URLs, staging without custom domain): ?tenant= param
  return new URL(req.url).searchParams.get('tenant')
}

export async function resolveTenant(slug: string): Promise<TenantContext | null> {
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (!tenant) return null

  const { data: settings } = await supabaseAdmin
    .from('tenant_settings')
    .select('*')
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  if (!settings) return null

  return { tenant, settings }
}

export async function resolveTenantFromRequest(req: NextRequest): Promise<TenantContext | null> {
  const slug = getTenantSlug(req)
  if (!slug) return null
  return resolveTenant(slug)
}
