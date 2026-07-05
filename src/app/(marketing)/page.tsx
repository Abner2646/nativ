import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { TenantSettings, TenantPhoto } from '@/lib/types'
import { ReservationPanel } from '@/components/public/ReservationPanel'
import { buildTheme } from '@/lib/theme'
import Image from 'next/image'

// Returns a Google Fonts URL for the restaurant's selected font (excluding Inter).
const GOOGLE_FONTS = new Set([
  'Poppins','Montserrat','Raleway','Nunito','Lato',
  'Merriweather','Playfair Display','Lora','EB Garamond','Cormorant Garamond','Libre Baskerville',
])
function restaurantFontUrl(fontFamily: string): string | null {
  const name = fontFamily.replace(/['"]/g, '').split(',')[0].trim()
  if (!GOOGLE_FONTS.has(name)) return null
  return `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, '+')}:wght@400;600;700&display=swap`
}

async function RestaurantPage({ slug }: { slug: string }) {
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle()

  if (!tenant) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#111015', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(242,239,233,0.42)', fontFamily: 'Inter, sans-serif' }}>Restaurant not found.</p>
      </main>
    )
  }

  const [{ data: settings }, { data: photos }] = await Promise.all([
    supabaseAdmin.from('tenant_settings').select('*').eq('tenant_id', tenant.id).maybeSingle(),
    supabaseAdmin.from('tenant_photos').select('*').eq('tenant_id', tenant.id).order('position'),
  ])

  if (!settings) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: '#111015', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(242,239,233,0.42)', fontFamily: 'Inter, sans-serif' }}>Restaurant coming soon.</p>
      </main>
    )
  }

  const s         = settings as TenantSettings
  const photoList = (photos as TenantPhoto[]) || []
  const theme     = buildTheme(s)
  const fontUrl   = restaurantFontUrl(s.font_family || 'Inter')

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
    <main style={{ backgroundColor: theme.bg, color: theme.text, minHeight: '100vh', fontFamily: theme.font }}>
      {fontUrl && <link rel="stylesheet" href={fontUrl} />}

      {/* ── Sticky nav ────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        backgroundColor: `${theme.bg}e0`,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${theme.border}`,
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
            color: theme.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {s.name}
          </span>
        </div>
        <a
          href="#reserve-panel"
          style={{
            backgroundColor: theme.primary,
            color: theme.primaryText,
            fontWeight: 700,
            fontSize: '0.8125rem',
            padding: '0.5rem 1.125rem',
            borderRadius: theme.btnRadius,
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
            background: `linear-gradient(to bottom, transparent 40%, ${theme.bg}e6 100%)`,
          }} />
        </div>
      ) : (
        <div style={{
          width: '100%', height: '10rem',
          background: `linear-gradient(135deg, ${theme.surface} 0%, ${theme.bg} 100%)`,
          borderBottom: `1px solid ${theme.border}`,
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
            theme={theme}
            availableDaysOfWeek={availableDaysOfWeek}
            blockedDates={blockedDates}
            websiteUrl={settings.website_url ?? null}
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
              color: theme.text,
              marginBottom: '0.75rem',
            }}>
              {s.name}
            </h1>
            {s.description && (
              <p style={{
                fontSize: '1.0625rem',
                color: theme.muted,
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
              borderTop: `1px solid ${theme.border}`,
              paddingTop: '1.75rem',
              marginBottom: '2rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))',
              gap: '1.5rem 2rem',
            }}>
              {s.address && (
                <div>
                  <p style={{ color: theme.faint, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Address
                  </p>
                  <p style={{ color: theme.text, fontSize: '0.9375rem', lineHeight: 1.6 }}>{s.address}</p>
                </div>
              )}
              {s.phone && (
                <div>
                  <p style={{ color: theme.faint, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Phone
                  </p>
                  <a href={`tel:${s.phone}`} style={{ color: theme.text, fontSize: '0.9375rem', textDecoration: 'none' }}>
                    {s.phone}
                  </a>
                </div>
              )}
              {s.hours_text && (
                <div>
                  <p style={{ color: theme.faint, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                    Hours
                  </p>
                  <p style={{ color: theme.text, fontSize: '0.9375rem', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{s.hours_text}</p>
                </div>
              )}
            </div>
          )}

          {/* Photo gallery (remaining photos after the hero) */}
          {galleryPhotos.length > 0 && (
            <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: '1.75rem' }}>
              <p style={{ color: theme.faint, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '1rem' }}>
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
                    style={{ aspectRatio: '4/3', borderRadius: '0.625rem', overflow: 'hidden', backgroundColor: theme.surface, position: 'relative' }}
                  >
                    <Image src={photo.url} alt="" fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 50vw, 200px" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* If no hero photo but has a logo, show gallery including first photo */}
          {!heroPhoto && photoList.length > 0 && (
            <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: '1.75rem' }}>
              <p style={{ color: theme.faint, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '1rem' }}>
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
                    style={{ aspectRatio: '4/3', borderRadius: '0.625rem', overflow: 'hidden', backgroundColor: theme.surface, position: 'relative' }}
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
      <footer style={{ borderTop: `1px solid ${theme.border}`, padding: '1.5rem 1.5rem' }}>
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
                style={{ color: theme.faint, fontSize: '0.875rem', textDecoration: 'none' }}
              >
                {l.label}
              </a>
            ))}
          </div>
          <p style={{ color: theme.faint, fontSize: '0.75rem' }}>Powered by Nativ</p>
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
        <span style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: '1.1875rem', color: C.midnight, letterSpacing: '-0.02em' }}>
          Nativ
        </span>
        <div className="flex items-center gap-5">
          <a href="/login" style={{ color: C.midnight, fontSize: '0.875rem', fontWeight: 500, opacity: 0.55 }}
            className="hidden sm:block hover:opacity-100 transition-opacity">
            Log in
          </a>
          <a href="/register"
            style={{ backgroundColor: C.midnight, color: C.offwhite, fontSize: '0.875rem', fontWeight: 600, padding: '0.5625rem 1.25rem', borderRadius: '0.5rem', textDecoration: 'none' }}
            className="hover:opacity-80 transition-opacity">
            Start free trial
          </a>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: C.midnight }} className="px-6 md:px-12 py-28 md:py-40">
        <div className="max-w-4xl mx-auto">
          <p style={{ color: C.sage, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.16em', fontFamily: "'Satoshi', sans-serif" }}
            className="uppercase mb-7">
            Reservation software for independent restaurants
          </p>
          <h1 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 'clamp(2.75rem, 7vw, 5.25rem)', lineHeight: '1.02', letterSpacing: '-0.035em', color: C.offwhite }}
            className="mb-7">
            You built the demand.<br />
            <span style={{ color: C.gold }}>The platform captured it.</span>
          </h1>
          <p style={{ color: 'rgba(250,250,248,0.50)', fontSize: '1.1875rem', lineHeight: '1.8', maxWidth: '35rem' }} className="mb-10">
            OpenTable, TheFork, Resy — every time a guest books through them, they're shown competing restaurants. You paid to bring them in. The platform decides where they go next.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a href="/register"
              style={{ backgroundColor: C.offwhite, color: C.midnight, fontWeight: 700, fontSize: '0.9375rem', padding: '1rem 2rem', borderRadius: '0.625rem', fontFamily: "'Satoshi', sans-serif", textDecoration: 'none' }}
              className="hover:opacity-90 transition-opacity text-center">
              Start free 14-day trial
            </a>
            <a href="#how-it-works"
              style={{ color: 'rgba(250,250,248,0.60)', fontWeight: 500, fontSize: '0.9375rem', padding: '1rem 2rem', borderRadius: '0.625rem', border: '1px solid rgba(255,255,255,0.12)', textDecoration: 'none' }}
              className="hover:text-white/80 hover:border-white/25 transition-all text-center">
              See how it works →
            </a>
          </div>
          <p style={{ color: 'rgba(250,250,248,0.25)', fontSize: '0.8125rem', marginTop: '1.75rem' }}>
            No credit card required · 14-day free trial · Cancel anytime
          </p>
        </div>
      </section>

      {/* ── Realization ─────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: C.offwhite }} className="px-6 md:px-12 py-28">
        <div className="max-w-4xl mx-auto">

          {/* Insight hook — this is where the realization lands */}
          <p style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 'clamp(1.625rem, 3.5vw, 2.625rem)', lineHeight: '1.25', letterSpacing: '-0.025em', color: C.midnight }}
            className="max-w-3xl mb-20">
            Every time a guest decides to book at your restaurant,
            the platform shows them{' '}
            <span style={{ color: C.gold }}>where else they can go.</span>
          </p>

          <div className="grid md:grid-cols-3 gap-10">
            {[
              {
                number: '01',
                title: 'Your traffic. Their marketplace.',
                body: 'You spent money on ads, social media and reputation. The moment a guest opens the platform, they\'re competing for their attention with every restaurant on the block.',
              },
              {
                number: '02',
                title: 'Your guest. Their brand.',
                body: 'The booking experience carries the platform\'s logo and identity. Guests remember where they booked — not who they dined with. You made the impression. They get the credit.',
              },
              {
                number: '03',
                title: 'Your data. Their database.',
                body: 'Visit history, preferences, contact details — it all belongs to the platform. The day you stop paying, you lose access to your own customers.',
              },
            ].map(item => (
              <div key={item.number}>
                <p style={{ color: C.gold, fontFamily: "'Satoshi', sans-serif", fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.12em', marginBottom: '1rem' }}
                  className="uppercase">
                  {item.number}
                </p>
                <h3 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: '1.0625rem', color: C.midnight, marginBottom: '0.75rem', lineHeight: '1.3' }}>
                  {item.title}
                </h3>
                <p style={{ color: '#4a5a68', fontSize: '0.9375rem', lineHeight: '1.8' }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The shift ───────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ backgroundColor: C.sand }} className="px-6 md:px-12 py-28">
        <div className="max-w-4xl mx-auto">
          <p style={{ color: C.sage, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', fontFamily: "'Satoshi', sans-serif" }}
            className="uppercase mb-4">
            The shift
          </p>
          <h2 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 'clamp(1.75rem, 4vw, 3rem)', lineHeight: '1.15', letterSpacing: '-0.025em', color: C.midnight }}
            className="mb-5 max-w-2xl">
            Reservation software that disappears inside your brand.
          </h2>
          <p style={{ color: '#4a5060', fontSize: '1.0625rem', lineHeight: '1.8', maxWidth: '38rem' }} className="mb-14">
            Nativ lives entirely within your website, your domain and your visual identity. No marketplace. No competing restaurants. No platform taking center stage.
          </p>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Before */}
            <div style={{ backgroundColor: '#ffffff', border: '1px solid rgba(74,90,104,0.14)', borderRadius: '1.25rem', padding: '2.25rem' }}>
              <p style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 600, fontSize: '0.75rem', color: '#8a9aaa', letterSpacing: '0.1em', marginBottom: '1.5rem' }}
                className="uppercase">
                Traditional platforms
              </p>
              <ul className="space-y-3.5">
                {[
                  'Competing restaurants on every screen',
                  'Platform branding throughout the experience',
                  'Guest data owned by the platform',
                  'You pay — they profit from your traffic',
                  'Guests remember the app, not your restaurant',
                ].map(item => (
                  <li key={item} className="flex items-start gap-3">
                    <span style={{ color: '#d4726a', fontWeight: 700, flexShrink: 0, marginTop: '0.125rem', fontSize: '0.875rem' }}>✕</span>
                    <span style={{ color: '#4a5a68', fontSize: '0.9375rem', lineHeight: '1.55' }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* After */}
            <div style={{ backgroundColor: C.midnight, borderRadius: '1.25rem', padding: '2.25rem' }}>
              <p style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 600, fontSize: '0.75rem', color: C.sage, letterSpacing: '0.1em', marginBottom: '1.5rem' }}
                className="uppercase">
                With Nativ
              </p>
              <ul className="space-y-3.5">
                {[
                  'Only your restaurant, on every screen',
                  'Your brand on every single touchpoint',
                  'Guest data is yours, forever',
                  'Every dollar reinforces your own brand',
                  'Guests remember you — they never left your world',
                ].map(item => (
                  <li key={item} className="flex items-start gap-3">
                    <span style={{ color: C.sage, fontWeight: 700, flexShrink: 0, marginTop: '0.125rem', fontSize: '0.875rem' }}>✓</span>
                    <span style={{ color: 'rgba(250,250,248,0.78)', fontSize: '0.9375rem', lineHeight: '1.55' }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── What you get — 3 outcome pillars ────────────────────────────── */}
      <section style={{ backgroundColor: C.offwhite }} className="px-6 md:px-12 py-28">
        <div className="max-w-4xl mx-auto">
          <p style={{ color: C.sage, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', fontFamily: "'Satoshi', sans-serif" }}
            className="uppercase mb-4">
            What you get
          </p>
          <h2 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 'clamp(1.75rem, 4vw, 3rem)', lineHeight: '1.15', letterSpacing: '-0.025em', color: C.midnight }}
            className="mb-16 max-w-xl">
            Everything a reservation system should do. Nothing it shouldn't.
          </h2>

          {/* 3 big outcome pillars */}
          <div className="grid sm:grid-cols-3 gap-8 mb-16">
            {[
              {
                accent: C.gold,
                title: 'Your brand.\nTheir reservation.',
                body: 'The booking widget lives inside your website. Your colors, your fonts, your domain. Guests never land on a third-party page — and they never should.',
              },
              {
                accent: C.sage,
                title: 'Your guests.\nYour data.',
                body: 'Every visit builds a profile you own: name, history, preferences, birthday. That data is yours permanently — not ours, not the platform\'s.',
              },
              {
                accent: C.sage,
                title: 'Your marketing.\nFull ROI.',
                body: 'Confirmations, reminders and birthday campaigns — all sent as your restaurant. Not as Nativ. Every touchpoint reinforces your brand, not ours.',
              },
            ].map((pillar, i) => (
              <div key={i} style={{ paddingTop: '1.5rem', borderTop: `2px solid ${pillar.accent}` }}>
                <h3 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: '1.25rem', color: C.midnight, marginBottom: '1rem', lineHeight: '1.2', whiteSpace: 'pre-line' }}>
                  {pillar.title}
                </h3>
                <p style={{ color: '#4a5a68', fontSize: '0.9375rem', lineHeight: '1.8' }}>
                  {pillar.body}
                </p>
              </div>
            ))}
          </div>

          {/* Also included — compact secondary list */}
          <div style={{ borderTop: '1px solid rgba(74,90,104,0.12)', paddingTop: '2rem' }}>
            <p style={{ color: '#8a9aaa', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.12em', marginBottom: '1.25rem' }}
              className="uppercase">
              Also included
            </p>
            <div className="grid sm:grid-cols-2 gap-x-12 gap-y-3">
              {[
                'Smart availability engine with shifts and areas',
                'Employee management and access control',
                'AI campaign suggestions — you approve before sending',
                'Birthday campaigns sent as your brand, automatically',
                'Embed on your site with one line of code',
                'Full reservation dashboard with complete guest history',
              ].map(item => (
                <div key={item} className="flex items-center gap-2.5">
                  <span style={{ color: C.sage, fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>✓</span>
                  <span style={{ color: '#4a5a68', fontSize: '0.9375rem' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Quote ───────────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: C.midnight }} className="px-6 md:px-12 py-28">
        <div className="max-w-3xl mx-auto text-center">
          <p style={{ color: C.gold, fontSize: '3rem', marginBottom: '1.5rem', opacity: 0.4, fontFamily: 'Georgia, serif', lineHeight: 1 }}>
            "
          </p>
          <blockquote style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 500, fontSize: 'clamp(1.375rem, 3vw, 2rem)', lineHeight: '1.5', color: C.offwhite, letterSpacing: '-0.015em' }}
            className="mb-8">
            I finally stopped paying a platform to show my customers where else they could eat.
          </blockquote>
          <p style={{ color: C.sage, fontSize: '0.875rem', fontWeight: 500 }}>— Restaurant owner, New York City</p>
        </div>
      </section>

      {/* ── Mid-page CTA — strike at peak emotion ───────────────────────── */}
      <section style={{ backgroundColor: C.offwhite, borderTop: `1px solid ${C.sand}`, borderBottom: `1px solid ${C.sand}` }}
        className="px-6 md:px-12 py-14">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h2 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 'clamp(1.375rem, 3vw, 2rem)', color: C.midnight, letterSpacing: '-0.02em', lineHeight: '1.2' }}>
              Ready to stop paying your competitors?
            </h2>
            <p style={{ color: '#7a8a98', fontSize: '0.9375rem', marginTop: '0.5rem' }}>
              14 days free. No credit card. No commitment.
            </p>
          </div>
          <a href="/register"
            style={{ backgroundColor: C.midnight, color: C.offwhite, fontWeight: 700, fontSize: '0.9375rem', padding: '1rem 2rem', borderRadius: '0.625rem', fontFamily: "'Satoshi', sans-serif", textDecoration: 'none', whiteSpace: 'nowrap' }}
            className="hover:opacity-80 transition-opacity text-center shrink-0">
            Start free trial →
          </a>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: C.offwhite }} className="px-6 md:px-12 py-28">
        <div className="max-w-3xl mx-auto text-center">
          <p style={{ color: C.sage, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', fontFamily: "'Satoshi', sans-serif" }}
            className="uppercase mb-4">
            Simple pricing
          </p>
          <h2 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 'clamp(1.75rem, 4vw, 3rem)', lineHeight: '1.1', letterSpacing: '-0.025em', color: C.midnight }}
            className="mb-5">
            One plan. No surprises.
          </h2>
          <p style={{ color: '#5a6a78', fontSize: '1.0625rem', lineHeight: '1.8' }} className="mb-12 max-w-xl mx-auto">
            A flat monthly rate that includes everything. No per-cover fees, no per-seat charges, no add-ons. Pay the same whether you do 50 reservations or 5,000.
          </p>

          <div style={{ backgroundColor: C.midnight, borderRadius: '1.5rem', padding: '2.75rem 2.25rem', maxWidth: '30rem', margin: '0 auto 3rem' }}>
            <p style={{ color: C.sage, fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.14em', fontFamily: "'Satoshi', sans-serif", marginBottom: '1.25rem' }}
              className="uppercase">
              Nativ Pro
            </p>
            <div className="flex items-end gap-2 justify-center mb-1">
              <span style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: '4.5rem', color: C.offwhite, lineHeight: 1 }}>$80</span>
              <span style={{ color: 'rgba(250,250,248,0.35)', fontSize: '1rem', paddingBottom: '0.75rem' }}>/month</span>
            </div>
            <p style={{ color: 'rgba(250,250,248,0.28)', fontSize: '0.8125rem', marginBottom: '2.25rem' }}>
              Traditional platforms: $300–$500/month + per-cover fees
            </p>
            <ul className="space-y-3.5 mb-8 text-left">
              {[
                'Unlimited reservations, always',
                'White-label booking widget',
                'Guest CRM — your data, your ownership',
                'Branded confirmations & reminders',
                'AI campaign suggestions',
                'Shifts, areas & availability engine',
                'Employee management',
                'Priority support',
              ].map(item => (
                <li key={item} className="flex items-center gap-3">
                  <span style={{ color: C.sage, fontWeight: 700, flexShrink: 0, fontSize: '0.875rem' }}>✓</span>
                  <span style={{ color: 'rgba(250,250,248,0.72)', fontSize: '0.9375rem' }}>{item}</span>
                </li>
              ))}
            </ul>
            <a href="/register"
              style={{ display: 'block', backgroundColor: C.offwhite, color: C.midnight, fontWeight: 700, fontSize: '0.9375rem', padding: '1.125rem', borderRadius: '0.75rem', fontFamily: "'Satoshi', sans-serif", textAlign: 'center', textDecoration: 'none' }}
              className="hover:opacity-90 transition-opacity">
              Start free 14-day trial
            </a>
            <p style={{ color: 'rgba(250,250,248,0.22)', fontSize: '0.8125rem', marginTop: '1rem', textAlign: 'center' }}>
              No credit card required
            </p>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: C.sand }} className="px-6 md:px-12 py-28">
        <div className="max-w-3xl mx-auto text-center">
          <h2 style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: 'clamp(2.5rem, 6vw, 4.25rem)', lineHeight: '1.05', letterSpacing: '-0.035em', color: C.midnight }}
            className="mb-6">
            Your restaurant.<br />Your guests.<br />Your brand.
          </h2>
          <p style={{ color: '#4a5060', fontSize: '1.125rem', lineHeight: '1.8' }} className="mb-10 max-w-xl mx-auto">
            Nativ doesn't help restaurants borrow customers. It helps them own the relationship with the ones they've already earned.
          </p>
          <a href="/register"
            style={{ display: 'inline-block', backgroundColor: C.midnight, color: C.offwhite, fontWeight: 700, fontSize: '1.0625rem', padding: '1.125rem 2.75rem', borderRadius: '0.75rem', fontFamily: "'Satoshi', sans-serif", textDecoration: 'none' }}
            className="hover:opacity-80 transition-opacity">
            Start your free trial
          </a>
          <p style={{ color: '#7a8890', fontSize: '0.8125rem', marginTop: '1.25rem' }}>
            14 days free · No credit card · Cancel anytime
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={{ backgroundColor: C.midnight, borderTop: '1px solid rgba(255,255,255,0.06)' }}
        className="px-6 md:px-12 pt-10 pb-8">
        <div className="max-w-4xl mx-auto">

          {/* Top row: brand + nav */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
            <span style={{ fontFamily: "'Satoshi', sans-serif", fontWeight: 700, fontSize: '1.0625rem', color: C.offwhite, letterSpacing: '-0.02em' }}>
              Nativ
            </span>
            <div className="flex flex-wrap gap-8">
              {[
                { label: 'Log in', href: '/login' },
                { label: 'Get started', href: '/register' },
              ].map(link => (
                <a key={link.href} href={link.href}
                  style={{ color: 'rgba(250,250,248,0.35)', fontSize: '0.875rem', textDecoration: 'none' }}
                  className="hover:text-white/70 transition-colors">
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Bottom row: copyright + developed by */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1.5rem' }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p style={{ color: 'rgba(250,250,248,0.18)', fontSize: '0.8125rem' }}>
              © {new Date().getFullYear()} Nativ
            </p>
            <div className="flex items-center gap-2">
              <span style={{ color: 'rgba(250,250,248,0.18)', fontSize: '0.75rem' }}>Developed by</span>
              <a href="https://norvex.dev" target="_blank" rel="noopener noreferrer"
                className="hover:opacity-60 transition-opacity">
                <img
                  src="/oa-global-logo.png"
                  alt="OA Global"
                  style={{ height: '18px', width: '72px', objectFit: 'contain', objectPosition: 'left', opacity: 0.35, filter: 'brightness(0) invert(1)' }}
                />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── Root page ────────────────────────────────────────────────────────────────

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; next?: string }>
}) {
  const [sp, headersList] = await Promise.all([searchParams, headers()])

  // Supabase sometimes sends the OAuth code to the Site URL instead of the
  // configured redirectTo when the redirect URL is not in the allowlist.
  // Catch it here and forward to the proper callback handler.
  if (sp.code) {
    const next = sp.next ? `&next=${encodeURIComponent(sp.next)}` : '&next=/dashboard'
    redirect(`/api/auth/callback?code=${encodeURIComponent(sp.code)}${next}`)
  }

  const tenantSlug = headersList.get('x-tenant-slug')

  if (tenantSlug) {
    return <RestaurantPage slug={tenantSlug} />
  }

  return <NativLanding />
}
