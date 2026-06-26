import { headers } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { TenantSettings, TenantPhoto } from '@/lib/types'

async function RestaurantPage({ slug }: { slug: string }) {
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, slug, tenant_settings(*), tenant_photos(*)')
    .eq('slug', slug)
    .maybeSingle()

  if (!tenant) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400">Restaurant not found.</p>
      </main>
    )
  }

  const settings = (tenant.tenant_settings as unknown as TenantSettings[])?.[0]
  const photos = (tenant.tenant_photos as unknown as TenantPhoto[]) || []

  if (!settings) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-400">Restaurant coming soon.</p>
      </main>
    )
  }

  const isDev = process.env.NODE_ENV === 'development'
  const reserveUrl = isDev ? `/reserve?tenant=${slug}` : `/reserve`

  const bg = settings.background_color || '#0a0a0a'
  const primary = settings.primary_color || '#ffffff'

  const socialLinks = [
    { label: 'Instagram', url: settings.instagram_url },
    { label: 'Facebook', url: settings.facebook_url },
    { label: 'TripAdvisor', url: settings.tripadvisor_url },
    { label: 'Yelp', url: settings.yelp_url },
  ].filter(s => s.url)

  return (
    <main style={{ backgroundColor: bg, fontFamily: settings.font_family || 'sans-serif' }} className="min-h-screen text-white">
      {/* Hero */}
      <section className="relative">
        {settings.logo_url ? (
          <div className="w-full h-64 sm:h-96 overflow-hidden">
            <img
              src={settings.logo_url}
              alt={settings.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/70" />
          </div>
        ) : (
          <div className="w-full h-48 sm:h-64" style={{ background: `linear-gradient(135deg, ${primary}22, ${bg})` }} />
        )}

        <div className="relative max-w-3xl mx-auto px-6 py-12">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4" style={{ color: primary }}>
            {settings.name}
          </h1>
          {settings.description && (
            <p className="text-lg text-gray-300 mb-8 max-w-xl">{settings.description}</p>
          )}
          <a
            href={reserveUrl}
            className="inline-block font-semibold px-8 py-4 rounded-lg text-black transition hover:opacity-90"
            style={{ backgroundColor: primary }}
          >
            Reserve a table
          </a>
        </div>
      </section>

      {/* Info */}
      {(settings.address || settings.phone || settings.hours_text) && (
        <section className="max-w-3xl mx-auto px-6 py-10 border-t border-white/10">
          <div className="grid sm:grid-cols-3 gap-8">
            {settings.address && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Address</p>
                <p className="text-sm text-gray-300">{settings.address}</p>
              </div>
            )}
            {settings.phone && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Phone</p>
                <a href={`tel:${settings.phone}`} className="text-sm text-gray-300 hover:text-white transition">
                  {settings.phone}
                </a>
              </div>
            )}
            {settings.hours_text && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Hours</p>
                <p className="text-sm text-gray-300 whitespace-pre-line">{settings.hours_text}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Gallery */}
      {photos.length > 0 && (
        <section className="max-w-3xl mx-auto px-6 py-10 border-t border-white/10">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {photos.map(photo => (
              <div key={photo.id} className="aspect-square rounded-xl overflow-hidden">
                <img src={photo.url} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="max-w-3xl mx-auto px-6 py-10 border-t border-white/10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex gap-4 flex-wrap">
            {socialLinks.map(s => (
              <a
                key={s.label}
                href={s.url!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 hover:text-white transition"
              >
                {s.label}
              </a>
            ))}
          </div>
          <a
            href={reserveUrl}
            className="text-sm font-semibold px-5 py-2.5 rounded-lg text-black transition hover:opacity-90"
            style={{ backgroundColor: primary }}
          >
            Reserve now
          </a>
        </div>
        <p className="text-xs text-gray-700 mt-6">Powered by Nativ</p>
      </footer>
    </main>
  )
}

function NativLanding() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <h1 className="text-6xl font-bold tracking-tight mb-4">Nativ</h1>
        <p className="text-xl text-gray-400 mb-3">Reservations that look like yours — not ours.</p>
        <p className="text-sm text-gray-600 mb-10">
          White-label reservation software for independent restaurants. No marketplace. No branding. Just your restaurant.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="/register" className="bg-white text-black font-semibold px-8 py-4 rounded-lg hover:bg-gray-100 transition text-center">
            Start free trial
          </a>
          <a href="/login" className="border border-gray-700 text-white font-semibold px-8 py-4 rounded-lg hover:border-gray-500 transition text-center">
            Log in
          </a>
        </div>
        <p className="text-xs text-gray-600 mt-6">14 days free. No credit card required.</p>
      </div>
    </main>
  )
}

export default async function Page() {
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-slug')

  if (tenantSlug) {
    return <RestaurantPage slug={tenantSlug} />
  }

  return <NativLanding />
}
