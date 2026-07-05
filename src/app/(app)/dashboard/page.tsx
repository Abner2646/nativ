import { requireUser, getUserTenants } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getTenantDomain } from '@/lib/domain'
import Link from 'next/link'

export default async function DashboardPage() {
  const user = await requireUser()
  const members = await getUserTenants(user.id)

  // Fetch first photo for each tenant (one query, all IDs)
  const tenantIds = members.map((m: any) => m.tenants?.id).filter(Boolean)
  let coverPhotos: Record<string, string> = {}
  if (tenantIds.length > 0) {
    const { data: photos } = await supabaseAdmin
      .from('tenant_photos')
      .select('tenant_id, url')
      .in('tenant_id', tenantIds)
      .order('position')
    if (photos) {
      for (const p of photos) {
        if (!coverPhotos[p.tenant_id]) coverPhotos[p.tenant_id] = p.url
      }
    }
  }

  return (
    <main className="min-h-screen bg-midnight text-offwhite">

      {/* ── Top bar ── */}
      <header className="px-8 py-4 flex items-center justify-between border-b border-white/[0.06]">
        <span className="font-satoshi font-bold text-xl tracking-tight text-offwhite">Nativ</span>
        <div className="flex items-center gap-5">
          <Link href="/account" className="text-sm text-offwhite/40 hover:text-offwhite/80 transition-colors">
            {user.email}
          </Link>
          <form action="/api/auth/logout" method="POST">
            <button className="text-sm text-offwhite/30 hover:text-offwhite/70 transition-colors">Log out</button>
          </form>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-8 py-12">

        <h1 className="font-satoshi font-bold text-2xl text-offwhite mb-8">Your restaurants</h1>

        {/* ── Grid ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">

          {members.map((m: any) => {
            const tenant = m.tenants
            const settings = tenant?.tenant_settings?.[0]
            const status: string = tenant?.status ?? 'unknown'
            const coverUrl = coverPhotos[tenant?.id] || settings?.logo_url || null
            const name = settings?.name || tenant?.slug || '?'
            const initial = name[0].toUpperCase()
            const accentColor = settings?.primary_color || '#1C2D42'

            const badgeClass =
              status === 'active' ? 'bg-sage/15 text-sage border border-sage/30'
              : status === 'trial' ? 'bg-gold/12 text-gold border border-gold/25'
              : 'bg-red-400/10 text-red-400 border border-red-400/20'

            return (
              <Link key={tenant?.id} href={`/restaurant/${tenant?.slug}`}
                className="group flex flex-col rounded-2xl overflow-hidden border border-white/[0.06] hover:border-white/[0.14] hover:-translate-y-0.5 transition-all duration-150">

                {/* ── Image / color area ── */}
                <div className="relative w-full" style={{ paddingBottom: '75%' }}>
                  {coverUrl ? (
                    <img src={coverUrl} alt={name}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ backgroundColor: accentColor }}>
                      <span className="font-satoshi font-bold text-white/80 select-none"
                        style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}>
                        {initial}
                      </span>
                    </div>
                  )}
                  {/* Status badge overlay */}
                  <div className="absolute top-2.5 right-2.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full backdrop-blur-sm ${badgeClass}`}>
                      {status}
                    </span>
                  </div>
                </div>

                {/* ── Info strip ── */}
                <div className="px-4 py-3.5 flex-1" style={{ backgroundColor: '#162232' }}>
                  <p className="font-satoshi font-semibold text-[14px] text-offwhite truncate leading-tight">
                    {name}
                  </p>
                  <p className="text-[12px] text-offwhite/35 mt-0.5 truncate">
                    {tenant?.slug ? getTenantDomain(tenant.slug) : ''}
                  </p>
                </div>
              </Link>
            )
          })}

          {/* ── Add restaurant card ── */}
          <Link href="/onboarding"
            className="group flex flex-col rounded-2xl overflow-hidden border border-dashed border-white/[0.12] hover:border-white/[0.28] hover:-translate-y-0.5 transition-all duration-150">
            {/* Same height ratio as other cards */}
            <div className="w-full flex flex-col items-center justify-center gap-2 transition-colors"
              style={{ paddingBottom: '75%', position: 'relative' }}>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                  <span className="text-offwhite/40 group-hover:text-offwhite/70 text-xl leading-none transition-colors">+</span>
                </div>
                <p className="text-xs font-semibold text-offwhite/35 group-hover:text-offwhite/60 transition-colors text-center px-3">
                  Add restaurant
                </p>
              </div>
            </div>
            {/* Bottom strip to match other cards */}
            <div className="px-4 py-3.5 flex-1" style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
              <p className="text-[14px] text-offwhite/20 font-satoshi">New restaurant</p>
              <p className="text-[12px] text-offwhite/15 mt-0.5">14-day free trial</p>
            </div>
          </Link>
        </div>
      </div>
    </main>
  )
}
