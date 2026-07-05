// src/lib/tenant.ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { TenantContext } from '@/lib/types'
import { getAppDomain } from '@/lib/domain'

export function getTenantSlug(req: NextRequest): string | null {
  const host = req.headers.get('host') || ''
  const url  = new URL(req.url)

  // 1. Subdomain routing (production public widget: slug.nativ.business)
  const domain = getAppDomain()
  if (domain && host.endsWith(`.${domain}`)) {
    const slug = host.slice(0, host.length - domain.length - 1)
    if (slug && slug !== 'www' && slug !== 'app') return slug
  }

  // 2. Query param fallback — used by admin panel API calls (?tenant=slug)
  //    Works in both dev and production.
  return url.searchParams.get('tenant')
}

export async function resolveTenant(slug: string): Promise<TenantContext | null> {
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (!tenant) return null

  // Auto-expire trials lazily: the next request after trial_ends_at marks it inactive.
  // No cron needed — self-heals on access.
  if (tenant.status === 'trial' && tenant.trial_ends_at && new Date(tenant.trial_ends_at) < new Date()) {
    await supabaseAdmin.from('tenants').update({ status: 'inactive' }).eq('id', tenant.id)
    tenant.status = 'inactive'
  }

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
