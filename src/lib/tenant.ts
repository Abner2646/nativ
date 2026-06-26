// src/lib/tenant.ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { TenantContext } from '@/lib/types'

const PROD_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || 'nativ.com'

export function getTenantSlug(req: NextRequest): string | null {
  const host = req.headers.get('host') || ''
  const isDev = host.includes('localhost')

  if (isDev) {
    return new URL(req.url).searchParams.get('tenant')
  }

  const slug = host.split(`.${PROD_DOMAIN}`)[0]
  if (!slug || slug === 'www' || slug === 'app' || host === PROD_DOMAIN) return null
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
