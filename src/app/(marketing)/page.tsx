import { headers } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { TenantSettings, TenantPhoto } from '@/lib/types'

// ─── Public restaurant page (tenant subdomain / ?tenant= param) ───────────────

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
      <section className="relative">
        {settings.logo_url ? (
          <div className="w-full h-64 sm:h-96 overflow-hidden">
            <img src={settings.logo_url} alt={settings.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/70" />
          </div>
        ) : (
          <div className="w-full h-48" style={{ background: `linear-gradient(135deg, ${primary}22, ${bg})` }} />
        )}
        <div className="relative max-w-3xl mx-auto px-6 py-12">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4" style={{ color: primary }}>{settings.name}</h1>
          {settings.description && <p className="text-lg text-gray-300 mb-8 max-w-xl">{settings.description}</p>}
          <a href={reserveUrl} className="inline-block font-semibold px-8 py-4 rounded-lg text-black transition hover:opacity-90" style={{ backgroundColor: primary }}>
            Reserve a table
          </a>
        </div>
      </section>

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
                <a href={`tel:${settings.phone}`} className="text-sm text-gray-300 hover:text-white transition">{settings.phone}</a>
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

      <footer className="max-w-3xl mx-auto px-6 py-10 border-t border-white/10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex gap-4 flex-wrap">
            {socialLinks.map(s => (
              <a key={s.label} href={s.url!} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-white transition">{s.label}</a>
            ))}
          </div>
          <a href={reserveUrl} className="text-sm font-semibold px-5 py-2.5 rounded-lg text-black transition hover:opacity-90" style={{ backgroundColor: primary }}>
            Reserve now
          </a>
        </div>
        <p className="text-xs text-gray-700 mt-6">Powered by Nativ</p>
      </footer>
    </main>
  )
}

// ─── Nativ marketing landing page ────────────────────────────────────────────

function NativLanding() {
  const C = {
    midnight: '#0F1720',
    sage:     '#6F8F7B',
    sand:     '#E7E2D6',
    offwhite: '#FAFAF8',
    gold:     '#C9A96E',
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", backgroundColor: C.offwhite, color: C.midnight }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav style={{ backgroundColor: C.offwhite, borderBottom: `1px solid ${C.sand}` }}
        className="sticky top-0 z-50 px-6 md:px-12 py-4 flex items-center justify-between">
        <span style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: '1.25rem', color: C.midnight, letterSpacing: '-0.02em' }}>
          NATIV
        </span>
        <div className="flex items-center gap-4">
          <a href="/login" style={{ color: C.midnight, fontSize: '0.875rem', fontWeight: 500 }}
            className="hidden sm:block hover:opacity-60 transition-opacity">
            Log in
          </a>
          <a href="/register"
            style={{ backgroundColor: C.midnight, color: C.offwhite, fontSize: '0.875rem', fontWeight: 600, padding: '0.625rem 1.25rem', borderRadius: '0.5rem' }}
            className="hover:opacity-80 transition-opacity">
            Start free trial
          </a>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: C.midnight }} className="px-6 md:px-12 py-24 md:py-36">
        <div className="max-w-4xl mx-auto">
          <p style={{ color: C.sage, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.12em', fontFamily: "'Satoshi', sans-serif" }}
            className="uppercase mb-6">
            Reservation software for independent restaurants
          </p>
          <h1 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', lineHeight: '1.05', letterSpacing: '-0.03em', color: C.offwhite }}
            className="mb-6">
            Your reservation system<br />
            is showing guests<br />
            <span style={{ color: C.gold }}>other restaurants.</span>
          </h1>
          <p style={{ color: '#8fa0ae', fontSize: '1.125rem', lineHeight: '1.7', maxWidth: '36rem' }} className="mb-10">
            Traditional platforms redirect your guests to their marketplace. You paid to bring them in. They capture the relationship. Nativ doesn't work that way.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a href="/register"
              style={{ backgroundColor: C.offwhite, color: C.midnight, fontWeight: 700, fontSize: '0.9375rem', padding: '1rem 2rem', borderRadius: '0.625rem', fontFamily: "'Satoshi', sans-serif" }}
              className="hover:opacity-90 transition-opacity text-center">
              Start free 14-day trial
            </a>
            <a href="#how-it-works"
              style={{ color: C.offwhite, fontWeight: 500, fontSize: '0.9375rem', padding: '1rem 2rem', borderRadius: '0.625rem', border: `1px solid rgba(255,255,255,0.15)` }}
              className="hover:border-white/40 transition-colors text-center">
              See how it works
            </a>
          </div>
          <p style={{ color: '#4a6070', fontSize: '0.8125rem', marginTop: '1.5rem' }}>
            No credit card required · Cancel anytime
          </p>
        </div>
      </section>

      {/* ── Problem ─────────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: C.offwhite }} className="px-6 md:px-12 py-24">
        <div className="max-w-4xl mx-auto">
          <p style={{ color: C.sage, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', fontFamily: "'Satoshi', sans-serif" }}
            className="uppercase mb-4">
            The problem
          </p>
          <h2 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', lineHeight: '1.15', letterSpacing: '-0.02em', color: C.midnight }}
            className="mb-6 max-w-2xl">
            You brought them in. The platform showed them where else to go.
          </h2>
          <p style={{ color: '#556070', fontSize: '1.0625rem', lineHeight: '1.7', maxWidth: '38rem' }} className="mb-16">
            Every marketing dollar you spend drives guests to your restaurant. But when they open your booking page on a traditional platform, you're competing for their attention with every restaurant listed nearby.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                number: '01',
                title: 'Competing listings',
                body: 'Guests booking at your restaurant are shown other restaurants on the same screen. You created the demand. The platform monetizes it.',
              },
              {
                number: '02',
                title: 'Someone else\'s brand',
                body: 'The booking experience carries the platform\'s logo, colors and identity — not yours. Guests remember the platform, not your restaurant.',
              },
              {
                number: '03',
                title: 'Data you don\'t own',
                body: 'Guest profiles, visit history and preferences belong to the platform. When you stop paying, so does your access to your own customers.',
              },
            ].map(item => (
              <div key={item.number}>
                <p style={{ color: C.gold, fontFamily: "'Satoshi', sans-serif", fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '1rem' }}
                  className="uppercase">
                  {item.number}
                </p>
                <h3 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 600, fontSize: '1.0625rem', color: C.midnight, marginBottom: '0.75rem' }}>
                  {item.title}
                </h3>
                <p style={{ color: '#556070', fontSize: '0.9375rem', lineHeight: '1.7' }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Solution ────────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ backgroundColor: C.sand }} className="px-6 md:px-12 py-24">
        <div className="max-w-4xl mx-auto">
          <p style={{ color: C.sage, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', fontFamily: "'Satoshi', sans-serif" }}
            className="uppercase mb-4">
            The shift
          </p>
          <h2 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', lineHeight: '1.15', letterSpacing: '-0.02em', color: C.midnight }}
            className="mb-6 max-w-2xl">
            Reservation software that disappears inside your brand.
          </h2>
          <p style={{ color: '#4a5060', fontSize: '1.0625rem', lineHeight: '1.7', maxWidth: '38rem' }} className="mb-16">
            Nativ lives entirely within your website, your domain and your visual identity. When a guest books a table, they never leave your world — and they never should.
          </p>

          <div className="grid md:grid-cols-2 gap-5">
            {[
              {
                label: 'Before Nativ',
                bg: '#ffffff',
                border: `1.5px solid ${C.sand}`,
                items: [
                  'Guests see competing restaurants',
                  'Platform branding on every screen',
                  'Data belongs to the platform',
                  'You pay to strengthen competitors',
                ],
                icon: '✕',
                iconColor: '#d4726a',
              },
              {
                label: 'With Nativ',
                bg: C.midnight,
                border: 'none',
                items: [
                  'Only your restaurant, always',
                  'Your brand on every touchpoint',
                  'Guest data is yours, forever',
                  'Every dollar reinforces your brand',
                ],
                icon: '✓',
                iconColor: C.sage,
              },
            ].map(col => (
              <div key={col.label} style={{ backgroundColor: col.bg, border: col.border, borderRadius: '1rem', padding: '2rem' }}>
                <p style={{
                  fontFamily: "'Satoshi', sans-serif",
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  color: col.bg === C.midnight ? C.sand : C.midnight,
                  letterSpacing: '0.08em',
                  marginBottom: '1.25rem',
                  opacity: 0.7,
                }}
                  className="uppercase">
                  {col.label}
                </p>
                <ul className="space-y-3">
                  {col.items.map(item => (
                    <li key={item} className="flex items-start gap-3">
                      <span style={{ color: col.iconColor, fontWeight: 700, flexShrink: 0, marginTop: '0.1rem' }}>{col.icon}</span>
                      <span style={{ color: col.bg === C.midnight ? '#d0dde8' : '#2a3540', fontSize: '0.9375rem', lineHeight: '1.5' }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: C.offwhite }} className="px-6 md:px-12 py-24">
        <div className="max-w-4xl mx-auto">
          <p style={{ color: C.sage, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', fontFamily: "'Satoshi', sans-serif" }}
            className="uppercase mb-4">
            What you get
          </p>
          <h2 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', lineHeight: '1.15', letterSpacing: '-0.02em', color: C.midnight }}
            className="mb-16 max-w-xl">
            Everything you need. Nothing that shouldn't be there.
          </h2>

          <div className="grid sm:grid-cols-2 gap-x-10 gap-y-12">
            {[
              {
                title: 'White-label booking widget',
                body: 'Embed the reservation experience directly on your website. Your colors, your fonts, your domain. Guests never land on a third-party page.',
              },
              {
                title: 'Guest profiles you own',
                body: 'Every reservation builds a profile: name, visit history, preferences, birthday. That data is yours — not ours, not the platform\'s.',
              },
              {
                title: 'Automated reminders',
                body: 'Confirmation and 24-hour reminder emails arrive branded as your restaurant. Not as Nativ. Guests remember who they dined with.',
              },
              {
                title: 'Smart availability engine',
                body: 'Configure shifts, seating areas, capacity and blocked dates. The system surfaces exactly the right slots without exposing internal complexity.',
              },
              {
                title: 'AI campaigns — when you approve them',
                body: 'The AI suggests re-engagement campaigns based on guest behavior. You review, edit and send. You stay in control of your voice.',
              },
              {
                title: 'Birthday campaigns',
                body: 'Send automatically branded birthday emails to guests. A small gesture that reinforces the relationship — in your name, not ours.',
              },
            ].map(f => (
              <div key={f.title}>
                <div style={{ width: '2rem', height: '2px', backgroundColor: C.gold, marginBottom: '1rem' }} />
                <h3 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 600, fontSize: '1.0625rem', color: C.midnight, marginBottom: '0.625rem' }}>
                  {f.title}
                </h3>
                <p style={{ color: '#556070', fontSize: '0.9375rem', lineHeight: '1.7' }}>
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quote ───────────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: C.midnight }} className="px-6 md:px-12 py-24">
        <div className="max-w-3xl mx-auto text-center">
          <p style={{ color: C.gold, fontSize: '1.5rem', marginBottom: '1rem', opacity: 0.6 }}>&ldquo;</p>
          <blockquote style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 500, fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', lineHeight: '1.5', color: C.offwhite, letterSpacing: '-0.01em' }}
            className="mb-8">
            I finally stopped paying OpenTable to show my customers where else they could eat.
          </blockquote>
          <p style={{ color: C.sage, fontSize: '0.875rem', fontWeight: 500 }}>— Restaurant owner, Buenos Aires</p>
        </div>
      </section>

      {/* ── Pricing / CTA ───────────────────────────────────────────────── */}
      <section style={{ backgroundColor: C.offwhite }} className="px-6 md:px-12 py-24">
        <div className="max-w-3xl mx-auto text-center">
          <p style={{ color: C.sage, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', fontFamily: "'Satoshi', sans-serif" }}
            className="uppercase mb-4">
            Simple pricing
          </p>
          <h2 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 'clamp(1.75rem, 4vw, 3rem)', lineHeight: '1.1', letterSpacing: '-0.02em', color: C.midnight }}
            className="mb-6">
            One plan. No surprises.
          </h2>
          <p style={{ color: '#556070', fontSize: '1.0625rem', lineHeight: '1.7' }} className="mb-12 max-w-xl mx-auto">
            A flat monthly rate that includes everything. No per-cover fees. No add-ons. No paying more as you grow.
          </p>

          <div style={{ backgroundColor: C.midnight, borderRadius: '1.25rem', padding: '2.5rem', maxWidth: '28rem', margin: '0 auto 3rem' }}>
            <p style={{ color: C.sage, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', fontFamily: "'Satoshi', sans-serif", marginBottom: '1rem' }}
              className="uppercase">
              Nativ Pro
            </p>
            <div className="flex items-end gap-2 justify-center mb-6">
              <span style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: '3.5rem', color: C.offwhite, lineHeight: 1 }}>$49</span>
              <span style={{ color: '#8fa0ae', fontSize: '0.9375rem', paddingBottom: '0.5rem' }}>/month</span>
            </div>
            <ul className="space-y-3 mb-8 text-left">
              {[
                'Unlimited reservations',
                'White-label booking widget',
                'Guest CRM with full data ownership',
                'Automated branded emails',
                'AI campaign suggestions',
                'Shifts, areas & availability engine',
                'Employee management',
                'Priority support',
              ].map(item => (
                <li key={item} className="flex items-center gap-3">
                  <span style={{ color: C.sage, fontWeight: 700, flexShrink: 0 }}>✓</span>
                  <span style={{ color: '#c8d8e4', fontSize: '0.9375rem' }}>{item}</span>
                </li>
              ))}
            </ul>
            <a href="/register"
              style={{ display: 'block', backgroundColor: C.offwhite, color: C.midnight, fontWeight: 700, fontSize: '0.9375rem', padding: '1rem', borderRadius: '0.625rem', fontFamily: "'Satoshi', sans-serif", textAlign: 'center' }}
              className="hover:opacity-90 transition-opacity">
              Start free 14-day trial
            </a>
            <p style={{ color: '#4a6070', fontSize: '0.8125rem', marginTop: '1rem', textAlign: 'center' }}>
              No credit card required
            </p>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: C.sand }} className="px-6 md:px-12 py-24">
        <div className="max-w-3xl mx-auto text-center">
          <h2 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 'clamp(2rem, 5vw, 3.5rem)', lineHeight: '1.1', letterSpacing: '-0.03em', color: C.midnight }}
            className="mb-6">
            Your restaurant.<br />Your guests.<br />Your brand.
          </h2>
          <p style={{ color: '#4a5060', fontSize: '1.0625rem', lineHeight: '1.7' }} className="mb-10 max-w-xl mx-auto">
            Nativ doesn't help restaurants borrow customers. It helps them own the relationship with the ones they've already earned.
          </p>
          <a href="/register"
            style={{ display: 'inline-block', backgroundColor: C.midnight, color: C.offwhite, fontWeight: 700, fontSize: '1rem', padding: '1.125rem 2.5rem', borderRadius: '0.75rem', fontFamily: "'Satoshi', sans-serif" }}
            className="hover:opacity-80 transition-opacity">
            Start your free trial
          </a>
          <p style={{ color: '#6a7880', fontSize: '0.8125rem', marginTop: '1.25rem' }}>
            14 days free · No credit card · Cancel anytime
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={{ backgroundColor: C.midnight, borderTop: `1px solid rgba(255,255,255,0.06)` }}
        className="px-6 md:px-12 py-10">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <span style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: '1rem', color: C.offwhite, letterSpacing: '-0.02em' }}>
            NATIV
          </span>
          <div className="flex flex-wrap gap-6">
            {[
              { label: 'Log in', href: '/login' },
              { label: 'Get started', href: '/register' },
            ].map(link => (
              <a key={link.href} href={link.href}
                style={{ color: '#6a8090', fontSize: '0.875rem' }}
                className="hover:text-white transition-colors">
                {link.label}
              </a>
            ))}
          </div>
          <p style={{ color: '#3a5060', fontSize: '0.8125rem' }}>
            © {new Date().getFullYear()} Nativ
          </p>
        </div>
      </footer>
    </div>
  )
}

// ─── Root page ────────────────────────────────────────────────────────────────

export default async function Page() {
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-slug')

  if (tenantSlug) {
    return <RestaurantPage slug={tenantSlug} />
  }

  return <NativLanding />
}
