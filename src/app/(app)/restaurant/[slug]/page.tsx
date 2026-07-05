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
  const nowTime = now.toTimeString().slice(0, 5) // HH:MM

  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1))
  const ws = weekStart.toISOString().split('T')[0]

  const [todayRes, weekRes, pendingCampaigns, nextRes] = await Promise.all([
    supabaseAdmin.from('reservations').select('party_size').eq('tenant_id', tenant.id).eq('date', today).eq('status', 'confirmed'),
    supabaseAdmin.from('reservations').select('party_size').eq('tenant_id', tenant.id).gte('date', ws).lte('date', today).eq('status', 'confirmed'),
    supabaseAdmin.from('ai_campaigns').select('id', { count: 'exact' }).eq('tenant_id', tenant.id).eq('status', 'pending'),
    supabaseAdmin.from('reservations').select('guest_name, time, party_size').eq('tenant_id', tenant.id).eq('date', today).eq('status', 'confirmed').gte('time', nowTime).order('time', { ascending: true }).limit(1),
  ])

  const sum = (d: { party_size: number }[] | null) => (d || []).reduce((s, r) => s + r.party_size, 0)
  const todayCount = todayRes.data?.length ?? 0
  const weekCount  = weekRes.data?.length ?? 0
  const todayCovers = sum(todayRes.data)
  const weekCovers  = sum(weekRes.data)
  const next = nextRes.data?.[0] ?? null

  const status: string = tenant.status ?? 'unknown'
  const badgeStyle: React.CSSProperties =
    status === 'active'  ? { background: 'rgba(111,143,123,0.15)', color: '#6F8F7B', border: '1px solid rgba(111,143,123,0.3)' }
    : status === 'trial' ? { background: 'rgba(201,169,110,0.12)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.25)' }
    :                      { background: 'rgba(224,85,85,0.12)',   color: '#e05555', border: '1px solid rgba(224,85,85,0.25)' }

  const cardBase: React.CSSProperties = {
    backgroundColor: '#162232',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '14px',
    padding: '24px',
  }

  const statLabel: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'rgba(242,239,233,0.4)',
    marginBottom: '12px',
  }

  const statNumber: React.CSSProperties = {
    fontFamily: 'Satoshi, sans-serif',
    fontWeight: 700,
    fontSize: '40px',
    lineHeight: 1,
    color: '#F2EFE9',
  }

  const statSub: React.CSSProperties = {
    fontSize: '13px',
    color: 'rgba(242,239,233,0.4)',
    marginTop: '6px',
  }

  return (
    <div className="p-8 bg-midnight min-h-screen">
      {/* ── Page title ── */}
      <h1 className="font-satoshi font-bold text-[22px] text-offwhite mb-8">Dashboard</h1>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">

        {/* Today — gold accent border */}
        <div style={{ ...cardBase, borderLeft: '2px solid #C9A96E' }}>
          <p style={statLabel}>Today</p>
          <p style={statNumber}>{todayCount}</p>
          <p style={statSub}>{todayCovers} covers</p>
        </div>

        {/* This week */}
        <div style={cardBase}>
          <p style={statLabel}>This week</p>
          <p style={statNumber}>{weekCount}</p>
          <p style={statSub}>{weekCovers} covers</p>
        </div>

        {/* Status */}
        <div style={cardBase}>
          <p style={statLabel}>Status</p>
          <div className="mt-1">
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={badgeStyle}>
              {status}
            </span>
          </div>
          {status === 'trial' && tenant.trial_ends_at && (
            <p style={{ ...statSub, marginTop: '10px' }}>
              Trial ends {new Date(tenant.trial_ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>

        {/* Next reservation today */}
        <div style={cardBase}>
          <p style={statLabel}>Next up today</p>
          {next ? (
            <>
              <p style={{ ...statNumber, fontSize: '28px' }}>{next.time.slice(0, 5)}</p>
              <p style={statSub}>{next.guest_name} · {next.party_size} {next.party_size === 1 ? 'person' : 'people'}</p>
            </>
          ) : (
            <p style={{ color: 'rgba(242,239,233,0.25)', fontSize: '14px', marginTop: '4px' }}>
              No more reservations today
            </p>
          )}
        </div>
      </div>

      {/* ── AI campaign alert ── */}
      {(pendingCampaigns.count ?? 0) > 0 && (
        <div className="flex items-center justify-between rounded-2xl px-6 py-5"
          style={{ backgroundColor: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.2)' }}>
          <div>
            <p className="font-satoshi font-semibold text-[15px]" style={{ color: '#C9A96E' }}>
              AI Campaign ready
            </p>
            <p className="text-sm mt-1" style={{ color: 'rgba(201,169,110,0.7)' }}>
              {pendingCampaigns.count} campaign{(pendingCampaigns.count ?? 0) > 1 ? 's' : ''} waiting for your approval.
            </p>
          </div>
          <Link href={`/restaurant/${slug}/campaigns`}
            className="text-sm font-semibold px-4 py-2.5 rounded-xl transition"
            style={{ backgroundColor: '#C9A96E', color: '#0F1720', borderRadius: '10px' }}>
            Review
          </Link>
        </div>
      )}
    </div>
  )
}
