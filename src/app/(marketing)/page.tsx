import { headers } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { TenantSettings, TenantPhoto } from '@/lib/types'
import { ReservationPanel } from '@/components/public/ReservationPanel'
import Image from 'next/image'

// Returns a Google Fonts URL for the restaurant's selected font (excluding Inter,
// which is already loaded in the root layout).
const GOOGLE_FONTS = new Set([
  'Poppins','Montserrat','Raleway','Nunito','Lato',
  'Merriweather','Playfair Display','Lora','EB Garamond','Cormorant Garamond','Libre Baskerville',
])
function restaurantFontUrl(fontFamily: string): string | null {
  const name = fontFamily.replace(/['"]/g, '').split(',')[0].trim()
  if (!GOOGLE_FONTS.has(name)) return null
  return `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}:wght@400;600;700&display=swap`
}

// ─── Public restaurant page (tenant subdomain / ?tenant= param) ───────────────

const R = {
  bg:      '#111015',
  surface: '#1c1a22',
  border:  'rgba(255,255,255,0.07)',
  text:    '#F2EFE9',
  muted:   'rgba(242,239,233,0.42)',
  faint:   'rgba(242,239,233,0.2)',
}

function safeAccent(raw: string | null | undefined): string {
  const bad = new Set(['#ffffff', '#fff', '#FFFFFF', '#FFF', '#000000', '#000', '#000000'])
  const v = (raw || '').trim()
  return bad.has(v) || !v ? '#C9A96E' : v
}

async function RestaurantPage({ slug }: { slug: string }) {
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle()

  if (!tenant) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: R.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: R.muted, fontFamily: 'Inter, sans-serif' }}>Restaurant not found.</p>
      </main>
    )
  }

  const [{ data: settings }, { data: photos }] = await Promise.all([
    supabaseAdmin.from('tenant_settings').select('*').eq('tenant_id', tenant.id).maybeSingle(),
    supabaseAdmin.from('tenant_photos').select('*').eq('tenant_id', tenant.id).order('position'),
  ])

  if (!settings) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: R.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: R.muted, fontFamily: 'Inter, sans-serif' }}>Restaurant coming soon.</p>
      </main>
    )
  }

  const s         = settings as TenantSettings
  const photoList = (photos as TenantPhoto[]) || []
  const accent    = safeAccent(s.primary_color)
  const font      = s.font_family || "'Inter', sans-serif"
  const fontUrl   = restaurantFontUrl(font)

  // Pre-fetch calendar data for the reservation panel
  const threeMonthsOut = new Date()
  threeMonthsOut.setMonth(threeMonthsOut.getMonth() + 3)
  const [{ data: shiftsData }, { data: blockedDatesData }] = await Promise.all([
    supabaseAdmin.from('shifts').select('day_of_week').eq('tenant_id', tenant.id).eq('is_active', true),
    supabaseAdmin.from('blocked_dates').select('date')
      .eq('tenant_id', tenant.id)
      .gte('date', new Date().toISOString().split('T')[0])
      .lte('date', threeMonthsOut.toISOString().split('T')[0]),
  ])
  const availableDaysOfWeek = [...new Set((shiftsData || []).map((s: { day_of_week: number }) => s.day_of_week))]
  const blockedDates = (blockedDatesData || []).map((b: { date: string }) => b.date)

  const socialLinks = [
    { label: 'Instagram',   url: s.instagram_url },
    { label: 'Facebook',    url: s.facebook_url },
    { label: 'TripAdvisor', url: s.tripadvisor_url },
    { label: 'Yelp',        url: s.yelp_url },
  ].filter(l => l.url)

  const hasInfo = !!(s.address || s.phone || s.hours_text)

  // Hero: first photo (wide), rest are the gallery
  const [heroPhoto, ...galleryPhotos] = photoList

  return (
    <main style={{ backgroundColor: R.bg, color: R.text, minHeight: '100vh', fontFamily: font }}>
      {fontUrl && <link rel="stylesheet" href={fontUrl} />}

      {/* ── Sticky nav ────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        backgroundColor: `${R.bg}e0`,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${R.border}`,
        padding: '0 1.5rem',
        height: '3.75rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', overflow: 'hidden' }}>
          {s.logo_url && (
            <div style={{ position: 'relative', height: '2rem', width: '3.5rem', flexShrink: 0, borderRadius: '0.3125rem', overflow: 'hidden' }}>
              <Image src={s.logo_url} alt="" fill style={{ objectFit: 'contain' }} sizes="56px" />
            </div>
          )}
          <span style={{
            fontWeight: 700,
            fontSize: '1rem',
            letterSpacing: '-0.02em',
            color: R.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {s.name}
          </span>
        </div>
        {/* Scrolls to the reservation panel on the page */}
        <a
          href="#reserve-panel"
          style={{
            backgroundColor: accent,
            color: '#0F1015',
            fontWeight: 700,
            fontSize: '0.8125rem',
            padding: '0.5rem 1.125rem',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Reserve
        </a>
      </nav>

      {/* ── Hero photo ────────────────────────────────────────────────── */}
      {heroPhoto ? (
        <div style={{ width: '100%', aspectRatio: '21/8', overflow: 'hidden', maxHeight: '28rem', position: 'relative' }}>
          <Image
            src={heroPhoto.url}
            alt=""
            fill
            style={{ objectFit: 'cover' }}
            priority
            sizes="100vw"
          />
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, transparent 40%, rgba(17,16,21,0.9) 100%)',
          }} />
        </div>
      ) : (
        <div style={{
          width: '100%', height: '10rem',
          background: `linear-gradient(135deg, ${R.surface} 0%, ${R.bg} 100%)`,
          borderBottom: `1px solid ${R.border}`,
        }} />
      )}

      {/* ── Main two-column area ──────────────────────────────────────── */}
      {/*
          Desktop: left column (restaurant info) + right column (sticky reservation panel)
          Mobile:  single column, panel appears above the info
          Using Tailwind for the responsive split since inline styles can't do media queries.
      */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">

        {/* ── Right: Reservation panel (first in DOM for mobile focus) ── */}
        <aside className="w-full lg:w-80 xl:w-96 shrink-0 order-first lg:order-last lg:sticky lg:top-20">
          <ReservationPanel
            slug={slug}
            accent={accent}
            fontFamily={font}
            availableDaysOfWeek={availableDaysOfWeek}
            blockedDates={blockedDates}
          />
        </aside>

        {/* ── Left: Restaurant content ─────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* Restaurant name + meta */}
          <div style={{ marginBottom: '2rem' }}>
            {s.logo_url && !heroPhoto && (
              <div style={{ position: 'relative', height: '3.5rem', width: '10rem', borderRadius: '0.625rem', overflow: 'hidden', marginBottom: '1.25rem' }}>
                <Image src={s.logo_url} alt={s.name} fill style={{ objectFit: 'contain', objectPosition: 'left center' }} sizes="160px" />
              </div>
            )}
            <h1 style={{
              fontWeight: 700,
              fontSize: 'clamp(2rem, 5vw, 3.25rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              color: R.text,
              marginBottom: '0.75rem',
            }}>
              {s.name}
            </h1>
            {s.description && (
              <p style={{
                fontSize: '1.0625rem',
                color: R.muted,
                lineHeight: 1.7,
                maxWidth: '38rem',
              }}>
                {s.description}
              </p>
            )}
          </div>

          {/* Info: address, phone, hours */}
          {hasInfo && (
            <div style={{
              borderTop: `1px solid ${R.border}`,
              paddingTop: '1.75rem',
              marginBottom: '2rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))',
              gap: '1.5rem 2rem',
            }}>
              {s.address && (
                <div>
                  <p style={{ color: R.faint, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Address
                  </p>
                  <p style={{ color: R.text, fontSize: '0.9375rem', lineHeight: 1.6 }}>{s.address}</p>
                </div>
              )}
              {s.phone && (
                <div>
                  <p style={{ color: R.faint, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Phone
                  </p>
                  <a href={`tel:${s.phone}`} style={{ color: R.text, fontSize: '0.9375rem', textDecoration: 'none' }}>
                    {s.phone}
                  </a>
                </div>
              )}
              {s.hours_text && (
                <div>
                  <p style={{ color: R.faint, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Hours
                  </p>
                  <p style={{ color: R.text, fontSize: '0.9375rem', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{s.hours_text}</p>
                </div>
              )}
            </div>
          )}

          {/* Photo gallery (remaining photos after the hero) */}
          {galleryPhotos.length > 0 && (
            <div style={{ borderTop: `1px solid ${R.border}`, paddingTop: '1.75rem' }}>
              <p style={{ color: R.faint, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '1rem' }}>
                Photos
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '0.5rem',
              }}>
                {galleryPhotos.map(photo => (
                  <div
                    key={photo.id}
                    style={{ aspectRatio: '4/3', borderRadius: '0.625rem', overflow: 'hidden', backgroundColor: R.surface, position: 'relative' }}
                  >
                    <Image src={photo.url} alt="" fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 50vw, 200px" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* If no hero photo but has a logo, show gallery including first photo */}
          {!heroPhoto && photoList.length > 0 && (
            <div style={{ borderTop: `1px solid ${R.border}`, paddingTop: '1.75rem' }}>
              <p style={{ color: R.faint, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '1rem' }}>
                Photos
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '0.5rem',
              }}>
                {photoList.map(photo => (
                  <div
                    key={photo.id}
                    style={{ aspectRatio: '4/3', borderRadius: '0.625rem', overflow: 'hidden', backgroundColor: R.surface, position: 'relative' }}
                  >
                    <Image src={photo.url} alt="" fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 50vw, 200px" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${R.border}`, padding: '1.5rem 1.5rem' }}>
        <div style={{
          maxWidth: '72rem', margin: '0 auto',
          display: 'flex', flexWrap: 'wrap',
          alignItems: 'center', justifyContent: 'space-between',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {socialLinks.map(l => (
              <a
                key={l.label}
                href={l.url!}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: R.faint, fontSize: '0.875rem', textDecoration: 'none' }}
              >
                {l.label}
              </a>
            ))}
          </div>
          <p style={{ color: R.faint, fontSize: '0.75rem' }}>Powered by Nativ</p>
        </div>
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
