// src/lib/tenant.ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { TenantContext } from '@/lib/types'
import { getAppDomain } from '@/lib/domain'

export function getTenantSlug(req: NextRequest): string | null {
  const host = req.headers.get('host') || ''
  const isDev = host.includes('localhost') || host.includes('127.0.0.1')

  if (isDev) {
    return new URL(req.url).searchParams.get('tenant')
  }

  const domain = getAppDomain()
  // Only extract a slug when the host is actually a subdomain of the configured domain.
  // Without this guard, hosts like nativ-xxx.vercel.app would produce garbage slugs.
  if (!domain || !host.endsWith(`.${domain}`)) return null
  const slug = host.slice(0, host.length - domain.length - 1)
  if (!slug || slug === 'www' || slug === 'app') return null
  return slug
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
