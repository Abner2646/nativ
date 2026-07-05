// Central helpers for app domain and tenant URL construction.
// Uses NEXT_PUBLIC_APP_DOMAIN (root domain) and NEXT_PUBLIC_APP_URL (base URL).
// Both are NEXT_PUBLIC so they work on server and client components alike.

export function getAppDomain(): string {
  return process.env.NEXT_PUBLIC_APP_DOMAIN ?? ''
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

function isLocal(): boolean {
  const url = getAppUrl()
  return url.includes('localhost') || url.includes('127.0.0.1')
}

// "slug.yourdomain.com" — for display only; shows tenant param in dev
export function getTenantDomain(slug: string): string {
  if (isLocal()) return `localhost · ${slug}`
  return `${slug}.${getAppDomain()}`
}

// Full URL to the tenant's public page (home or reserve page)
export function getTenantBaseUrl(slug: string): string {
  if (isLocal()) return `${getAppUrl()}?tenant=${slug}`
  return `https://${slug}.${getAppDomain()}`
}

// Full URL to the tenant's standalone reservation page
export function getTenantReserveUrl(slug: string): string {
  if (isLocal()) return `${getAppUrl()}/reserve?tenant=${slug}`
  return `https://${slug}.${getAppDomain()}/reserve`
}
