// Central helpers for app domain and tenant URL construction.
// Uses NEXT_PUBLIC_APP_DOMAIN (root domain) and NEXT_PUBLIC_APP_URL (base URL).
// Both are NEXT_PUBLIC so they work on server and client components alike.

export function getAppDomain(): string {
  return process.env.NEXT_PUBLIC_APP_DOMAIN ?? ''
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

// Returns true only when a custom domain is configured AND APP_URL is hosted on
// that same domain, meaning wildcard subdomain routing actually works.
// Vercel preview URLs (nativ-xxx.vercel.app) never satisfy this check.
function supportsSubdomains(): boolean {
  const appDomain = getAppDomain()
  if (!appDomain) return false
  try {
    const urlHost = new URL(getAppUrl()).hostname
    return urlHost === appDomain || urlHost === `www.${appDomain}`
  } catch {
    return false
  }
}

// "oth.yourdomain.com" — for display only; falls back to just the slug when no domain
export function getTenantDomain(slug: string): string {
  const domain = getAppDomain()
  return domain ? `${slug}.${domain}` : slug
}

// Full URL to the tenant's public page
export function getTenantBaseUrl(slug: string): string {
  if (supportsSubdomains()) return `https://${slug}.${getAppDomain()}`
  return `${getAppUrl()}?tenant=${slug}`
}

// Full URL to the tenant's standalone reservation page
export function getTenantReserveUrl(slug: string): string {
  if (supportsSubdomains()) return `https://${slug}.${getAppDomain()}/reserve`
  return `${getAppUrl()}/reserve?tenant=${slug}`
}
