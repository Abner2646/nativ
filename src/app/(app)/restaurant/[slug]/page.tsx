import { requireUser, getTenantBySlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export default async function RestaurantDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  const access = await getTenantBySlug(slug, user.id)
  if (!access) return notFound()

  const { tenant } = access

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const nowTime = now.toTimeString().slice(0, 5)

  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1))
  const ws = weekStart.toISOString().split('T')[0]

  const [todayRes, weekRes, pendingCampaigns, nextRes, shiftsRes, areasRes, settingsRes] = await Promise.all([
    supabaseAdmin.from('reservations').select('party_size').eq('tenant_id', tenant.id).eq('date', today).eq('status', 'confirmed'),
    supabaseAdmin.from('reservations').select('party_size').eq('tenant_id', tenant.id).gte('date', ws).lte('date', today).eq('status', 'confirmed'),
    supabaseAdmin.from('ai_campaigns').select('id', { count: 'exact' }).eq('tenant_id', tenant.id).eq('status', 'pending'),
    supabaseAdmin.from('reservations').select('guest_name, time, party_size').eq('tenant_id', tenant.id).eq('date', today).eq('status', 'confirmed').gte('time', nowTime).order('time', { ascending: true }).limit(1),
    supabaseAdmin.from('shifts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
    supabaseAdmin.from('seating_areas').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
    supabaseAdmin.from('tenant_settings').select('description, address, stripe_account_id').eq('tenant_id', tenant.id).single(),
  ])

  const sum = (d: { party_size: number }[] | null) => (d || []).reduce((s, r) => s + r.party_size, 0)
  const todayCount  = todayRes.data?.length ?? 0
  const weekCount   = weekRes.data?.length ?? 0
  const todayCovers = sum(todayRes.data)
  const weekCovers  = sum(weekRes.data)
  const next        = nextRes.data?.[0] ?? null

  const settings = settingsRes.data
  const onboarding = {
    hasShift:   (shiftsRes.count ?? 0) > 0,
    hasArea:    (areasRes.count ?? 0) > 0,
    hasProfile: !!(settings?.description || settings?.address),
    hasStripe:  !!settings?.stripe_account_id,
  }
  const onboardingDone = Object.values(onboarding).every(Boolean)

  const status: string = tenant.status ?? 'unknown'
  const badgeStyle: React.CSSProperties =
    status === 'active'  ? { background: 'rgba(111,143,123,0.15)', color: '#6F8F7B', border: '1px solid rgba(111,143,123,0.3)' }
    : status === 'trial' ? { background: 'rgba(201,169,110,0.12)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.25)' }
    :                      { background: 'rgba(224,85,85,0.12)',   color: '#e05555', border: '1px solid rgba(224,85,85,0.25)' }

  const card = 'rounded-2xl p-5 md:p-6'
  const cardBg: React.CSSProperties = { backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }

  return (
    <div className="p-4 md:p-8 bg-midnight min-h-screen">

      {/* ── Page title ── */}
      <h1 className="font-satoshi font-bold text-[22px] text-offwhite mb-6 md:mb-8">Dashboard</h1>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-5 mb-6 md:mb-8">

        {/* Today — gold accent */}
        <div className={card} style={{ ...cardBg, borderLeft: '2px solid #C9A96E' }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-offwhite/40 mb-3">Today</p>
          <p className="font-satoshi font-bold text-[36px] md:text-[40px] leading-none text-offwhite">{todayCount}</p>
          <p className="text-[13px] text-offwhite/40 mt-1.5">{todayCovers} covers</p>
        </div>

        {/* This week */}
        <div className={card} style={cardBg}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-offwhite/40 mb-3">This week</p>
          <p className="font-satoshi font-bold text-[36px] md:text-[40px] leading-none text-offwhite">{weekCount}</p>
          <p className="text-[13px] text-offwhite/40 mt-1.5">{weekCovers} covers</p>
        </div>

        {/* Status */}
        <div className={card} style={cardBg}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-offwhite/40 mb-3">Status</p>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={badgeStyle}>
            {status}
          </span>
          {status === 'trial' && tenant.trial_ends_at && (
            <p className="text-[13px] text-offwhite/40 mt-2.5">
              Ends {new Date(tenant.trial_ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>

        {/* Next reservation */}
        <div className={card} style={cardBg}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-offwhite/40 mb-3">Next up</p>
          {next ? (
            <>
              <p className="font-satoshi font-bold text-[28px] leading-none text-offwhite">{next.time.slice(0, 5)}</p>
              <p className="text-[13px] text-offwhite/40 mt-1.5 truncate">
                {next.guest_name} · {next.party_size} {next.party_size === 1 ? 'person' : 'people'}
              </p>
            </>
          ) : (
            <p className="text-[14px] text-offwhite/25 mt-1">No more today</p>
          )}
        </div>
      </div>

      {/* ── Onboarding checklist ── */}
      {!onboardingDone && (
        <div className="rounded-2xl px-4 py-4 md:px-6 md:py-5 mb-6 md:mb-8"
          style={cardBg}>
          <p className="font-satoshi font-bold text-[15px] text-offwhite mb-1">Get started</p>
          <p className="text-sm text-offwhite/40 mb-4">Complete these steps to start accepting reservations.</p>
          <div className="space-y-2">
            {[
              { done: onboarding.hasShift,   label: 'Create your first shift',           href: `/restaurant/${slug}/shifts` },
              { done: onboarding.hasArea,    label: 'Add a seating area',                href: `/restaurant/${slug}/areas` },
              { done: onboarding.hasProfile, label: 'Fill in your restaurant profile',   href: `/restaurant/${slug}/settings` },
              { done: onboarding.hasStripe,  label: 'Connect Stripe to accept deposits', href: `/restaurant/${slug}/deposits` },
            ].map(step => (
              <Link key={step.href} href={step.href}
                className={`flex items-center gap-3 px-3 py-2.5 md:px-4 md:py-3 rounded-xl transition-colors group ${
                  step.done ? 'opacity-50 pointer-events-none' : 'hover:bg-white/[0.03]'
                }`}
                style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs"
                  style={step.done
                    ? { backgroundColor: 'rgba(111,143,123,0.2)', border: '1px solid rgba(111,143,123,0.4)', color: '#6F8F7B' }
                    : { backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(242,239,233,0.3)' }}>
                  {step.done ? '✓' : ''}
                </span>
                <span className={`text-sm flex-1 min-w-0 truncate ${
                  step.done ? 'line-through text-offwhite/30' : 'text-offwhite/70 group-hover:text-offwhite'
                }`}>
                  {step.label}
                </span>
                {!step.done && <span className="text-xs text-offwhite/25 group-hover:text-offwhite/50 shrink-0">→</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── AI campaign alert ── */}
      {(pendingCampaigns.count ?? 0) > 0 && (
        <div className="flex items-center justify-between gap-4 flex-wrap rounded-2xl px-4 py-4 md:px-6 md:py-5"
          style={{ backgroundColor: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.2)' }}>
          <div className="min-w-0">
            <p className="font-satoshi font-semibold text-[15px]" style={{ color: '#C9A96E' }}>
              AI Campaign ready
            </p>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(201,169,110,0.7)' }}>
              {pendingCampaigns.count} campaign{(pendingCampaigns.count ?? 0) > 1 ? 's' : ''} waiting for your approval.
            </p>
          </div>
          <Link href={`/restaurant/${slug}/campaigns`}
            className="shrink-0 text-sm font-semibold px-4 py-2.5 rounded-xl transition"
            style={{ backgroundColor: '#C9A96E', color: '#0F1720' }}>
            Review
          </Link>
        </div>
      )}
    </div>
  )
}
