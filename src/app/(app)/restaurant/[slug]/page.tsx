import { requireUser, getTenantBySlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'

export default async function RestaurantDashboard({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  const access = await getTenantBySlug(slug, user.id)
  if (!access) return notFound()

  const { tenant } = access

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1))
  const ws = weekStart.toISOString().split('T')[0]

  const [todayRes, weekRes, pendingCampaigns] = await Promise.all([
    supabaseAdmin.from('reservations').select('party_size').eq('tenant_id', tenant.id).eq('date', today).eq('status', 'confirmed'),
    supabaseAdmin.from('reservations').select('party_size').eq('tenant_id', tenant.id).gte('date', ws).lte('date', today).eq('status', 'confirmed'),
    supabaseAdmin.from('ai_campaigns').select('id', { count: 'exact' }).eq('tenant_id', tenant.id).eq('status', 'pending'),
  ])

  const sum = (d: { party_size: number }[] | null) => (d || []).reduce((s, r) => s + r.party_size, 0)

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Today</p>
          <p className="text-4xl font-bold">{todayRes.data?.length ?? 0}</p>
          <p className="text-sm text-gray-500 mt-1">{sum(todayRes.data)} covers</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">This week</p>
          <p className="text-4xl font-bold">{weekRes.data?.length ?? 0}</p>
          <p className="text-sm text-gray-500 mt-1">{sum(weekRes.data)} covers</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Status</p>
          <p className={`text-2xl font-bold ${
            tenant.status === 'active' ? 'text-green-400'
            : tenant.status === 'trial' ? 'text-yellow-400'
            : 'text-red-400'
          }`}>
            {tenant.status}
          </p>
          {tenant.status === 'trial' && (
            <p className="text-sm text-gray-500 mt-1">
              Trial ends {new Date(tenant.trial_ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
      </div>

      {(pendingCampaigns.count ?? 0) > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="font-semibold text-yellow-300">AI Campaign Ready</p>
            <p className="text-sm text-yellow-400/80 mt-1">
              {pendingCampaigns.count} campaign{(pendingCampaigns.count ?? 0) > 1 ? 's' : ''} waiting for your approval.
            </p>
          </div>
          <a
            href={`/restaurant/${slug}/campaigns`}
            className="bg-yellow-500 text-black font-semibold px-4 py-2 rounded-lg text-sm hover:bg-yellow-400 transition"
          >
            Review
          </a>
        </div>
      )}
    </div>
  )
}
