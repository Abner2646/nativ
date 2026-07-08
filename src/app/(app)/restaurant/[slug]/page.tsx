import { requireUser, getTenantBySlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

// Dashboard = pulso del negocio, solo para admins.
// Los empleados aterrizan en el Floor plan: ESA es su vista operativa.
export default async function RestaurantDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  const access = await getTenantBySlug(slug, user.id)
  if (!access) return notFound()
  if (access.role === 'employee') redirect(`/restaurant/${slug}/floor-plan`)

  const { tenant } = access

  // Fechas en el timezone del restaurante, no del server
  const { data: settings } = await supabaseAdmin
    .from('tenant_settings')
    .select('timezone, description, address, stripe_account_id')
    .eq('tenant_id', tenant.id).single()

  const tz = settings?.timezone || 'America/New_York'
  const now = new Date()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now)
  const nowTime = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now)
  const daysAgo = (n: number) => {
    const d = new Date(now.getTime() - n * 86_400_000)
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d)
  }

  const [todayRes, last7, prev7, cancelledToday, pendingCampaigns, shiftsRes, areasRes] = await Promise.all([
    supabaseAdmin.from('reservations')
      .select('id, time, party_size, occasion, seated_at, guest:guests(name), table_assignments(table_id)')
      .eq('tenant_id', tenant.id).eq('date', today).eq('status', 'confirmed').order('time'),
    supabaseAdmin.from('reservations').select('party_size')
      .eq('tenant_id', tenant.id).gte('date', daysAgo(6)).lte('date', today).eq('status', 'confirmed'),
    supabaseAdmin.from('reservations').select('party_size')
      .eq('tenant_id', tenant.id).gte('date', daysAgo(13)).lte('date', daysAgo(7)).eq('status', 'confirmed'),
    supabaseAdmin.from('reservations').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id).eq('date', today).eq('status', 'cancelled'),
    supabaseAdmin.from('ai_campaigns').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id).eq('status', 'pending'),
    supabaseAdmin.from('shifts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
    supabaseAdmin.from('seating_areas').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id),
  ])

  type TodayRow = {
    id: string; time: string; party_size: number; occasion: string | null
    seated_at: string | null
    guest: { name: string } | null
    table_assignments: { table_id: string }[]
  }
  const todayList = (todayRes.data || []) as unknown as TodayRow[]

  const sum = (d: { party_size: number }[] | null) => (d || []).reduce((s, r) => s + r.party_size, 0)
  const todayCovers  = sum(todayList)
  const last7Covers  = sum(last7.data)
  const prev7Covers  = sum(prev7.data)
  const weekDelta    = prev7Covers > 0 ? Math.round(((last7Covers - prev7Covers) / prev7Covers) * 100) : null

  const upcoming   = todayList.filter(r => r.time.slice(0, 5) >= nowTime && !r.seated_at)
  const next       = upcoming[0] ?? null
  const highlights = todayList.filter(r => r.occasion || r.party_size >= 6)
  const unassigned = todayList.filter(r => r.table_assignments.length === 0 && !r.seated_at).length
  const cancelled  = cancelledToday.count ?? 0

  const onboarding = {
    hasShift:   (shiftsRes.count ?? 0) > 0,
    hasArea:    (areasRes.count ?? 0) > 0,
    hasProfile: !!(settings?.description || settings?.address),
    hasStripe:  !!settings?.stripe_account_id,
  }
  const onboardingDone = Object.values(onboarding).every(Boolean)

  // Status solo como alerta accionable: trial por vencer
  const trialDaysLeft = tenant.status === 'trial' && tenant.trial_ends_at
    ? Math.ceil((new Date(tenant.trial_ends_at).getTime() - Date.now()) / 86_400_000)
    : null
  const trialWarning = trialDaysLeft !== null && trialDaysLeft <= 5

  const card = 'rounded-2xl p-5 md:p-6'
  const cardBg: React.CSSProperties = { backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }
  const fmtTime = (t: string) => t.slice(0, 5)

  return (
    <div className="p-4 md:p-8 bg-midnight min-h-screen">

      <h1 className="font-satoshi font-bold text-[22px] text-offwhite mb-6 md:mb-8">Dashboard</h1>

      {/* ── Trial por vencer: la única aparición del status, y solo si es accionable ── */}
      {trialWarning && (
        <div className="flex items-center justify-between gap-4 flex-wrap rounded-2xl px-4 py-4 md:px-6 md:py-4 mb-6"
          style={{ backgroundColor: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)' }}>
          <p className="text-sm" style={{ color: '#fb923c' }}>
            Your trial ends {trialDaysLeft === 0 ? 'today' : trialDaysLeft === 1 ? 'tomorrow' : `in ${trialDaysLeft} days`} — set up billing to keep taking reservations.
          </p>
          <Link href={`/restaurant/${slug}/billing`}
            className="shrink-0 text-sm font-semibold px-4 py-2 rounded-xl"
            style={{ backgroundColor: '#fb923c', color: '#0F1720' }}>
            Go to Billing
          </Link>
        </div>
      )}

      {/* ── Pulso de hoy ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-5 mb-6 md:mb-8">

        {/* Tonight */}
        <div className={card} style={{ ...cardBg, borderLeft: '2px solid #C9A96E' }}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-offwhite/40 mb-3">Today</p>
          <p className="font-satoshi font-bold text-[36px] md:text-[40px] leading-none text-offwhite">{todayList.length}</p>
          <p className="text-[13px] text-offwhite/40 mt-1.5">{todayCovers} covers</p>
        </div>

        {/* Next up */}
        <div className={card} style={cardBg}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-offwhite/40 mb-3">Next up</p>
          {next ? (
            <>
              <p className="font-satoshi font-bold text-[28px] leading-none text-offwhite">{fmtTime(next.time)}</p>
              <p className="text-[13px] text-offwhite/40 mt-1.5 truncate">
                {next.guest?.name} · {next.party_size} {next.party_size === 1 ? 'person' : 'people'}
              </p>
              {upcoming.length > 1 && (
                <p className="text-[11px] text-offwhite/25 mt-1">+{upcoming.length - 1} more tonight</p>
              )}
            </>
          ) : (
            <p className="text-[14px] text-offwhite/25 mt-1">No more today</p>
          )}
        </div>

        {/* Last 7 days vs previous */}
        <div className={card} style={cardBg}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-offwhite/40 mb-3">Last 7 days</p>
          <p className="font-satoshi font-bold text-[36px] md:text-[40px] leading-none text-offwhite">{last7Covers}</p>
          <p className="text-[13px] mt-1.5">
            <span className="text-offwhite/40">covers</span>
            {weekDelta !== null && (
              <span className="ml-2 font-semibold" style={{ color: weekDelta >= 0 ? '#6F8F7B' : '#e05555' }}>
                {weekDelta >= 0 ? '+' : ''}{weekDelta}% vs prior week
              </span>
            )}
          </p>
        </div>

        {/* Cancellations today */}
        <div className={card} style={cancelled > 0 ? { ...cardBg, borderLeft: '2px solid rgba(224,85,85,0.6)' } : cardBg}>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-offwhite/40 mb-3">Cancelled today</p>
          <p className="font-satoshi font-bold text-[36px] md:text-[40px] leading-none"
            style={{ color: cancelled > 0 ? '#e08585' : 'rgba(242,239,233,0.35)' }}>
            {cancelled}
          </p>
        </div>
      </div>

      {/* ── Necesita atención: reservas de hoy sin mesa ── */}
      {unassigned > 0 && (
        <Link href={`/restaurant/${slug}/floor-plan`}
          className="flex items-center justify-between gap-4 rounded-2xl px-4 py-4 md:px-6 mb-6 transition-colors hover:bg-white/[0.02]"
          style={{ backgroundColor: 'rgba(201,169,110,0.06)', border: '1px solid rgba(201,169,110,0.20)' }}>
          <p className="text-sm" style={{ color: '#C9A96E' }}>
            <strong>{unassigned}</strong> reservation{unassigned > 1 ? 's' : ''} today still need{unassigned === 1 ? 's' : ''} a table
          </p>
          <span className="text-sm shrink-0" style={{ color: '#C9A96E' }}>Assign on floor plan →</span>
        </Link>
      )}

      {/* ── Highlights de hoy: ocasiones y parties grandes ── */}
      {highlights.length > 0 && (
        <div className="rounded-2xl overflow-hidden mb-6 md:mb-8" style={cardBg}>
          <div className="px-4 md:px-6 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-offwhite/40">Tonight's highlights</p>
          </div>
          {highlights.map((r, i) => (
            <div key={r.id} className="flex items-center gap-3 px-4 md:px-6 py-3"
              style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.04)' } : undefined}>
              <span className="font-mono text-sm font-semibold text-offwhite w-[46px] shrink-0">{fmtTime(r.time)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-offwhite truncate">{r.guest?.name}</p>
              </div>
              {r.party_size >= 6 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(242,239,233,0.6)', border: '1px solid rgba(255,255,255,0.10)' }}>
                  {r.party_size} people
                </span>
              )}
              {r.occasion && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                  style={{ backgroundColor: 'rgba(201,169,110,0.12)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.25)' }}>
                  {r.occasion}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Onboarding checklist (desaparece al completarse) ── */}
      {!onboardingDone && (
        <div className="rounded-2xl px-4 py-4 md:px-6 md:py-5 mb-6 md:mb-8" style={cardBg}>
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
