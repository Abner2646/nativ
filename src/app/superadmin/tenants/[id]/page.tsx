import { requireSuperadmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { StatusBadge } from '../../page'
import { TenantActionsClient } from './TenantActionsClient'
import Link from 'next/link'

export default async function SuperadminTenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireSuperadmin()
  const { id } = await params

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

  const [
    { data: tenant },
    { data: members },
    { count: reservations30d },
    { count: guestCount },
    { count: reservationsTotal },
  ] = await Promise.all([
    supabaseAdmin
      .from('tenants')
      .select('*, tenant_settings(*)')
      .eq('id', id)
      .maybeSingle(),
    supabaseAdmin
      .from('tenant_members')
      .select('role, created_at, profiles(email, full_name)')
      .eq('tenant_id', id)
      .order('created_at'),
    supabaseAdmin
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', id)
      .gte('created_at', thirtyDaysAgo),
    supabaseAdmin
      .from('guests')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', id),
    supabaseAdmin
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', id),
  ])

  if (!tenant) return notFound()

  const settings = (tenant as any).tenant_settings?.[0]
  const name = settings?.name || tenant.slug
  const trialEnd = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null
  const daysLeft = trialEnd ? Math.ceil((trialEnd.getTime() - Date.now()) / 86400000) : null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <Link href="/superadmin/tenants" className="text-xs text-offwhite/30 hover:text-offwhite/60 transition-colors">← Tenants</Link>
          </div>
          <h1 className="font-satoshi font-bold text-2xl text-offwhite">{name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge status={tenant.status} />
            <span className="text-sm text-offwhite/30 font-mono">{tenant.slug}</span>
            <Link
              href={`/restaurant/${tenant.slug}`}
              className="text-xs text-offwhite/30 hover:text-offwhite/60 transition-colors"
              target="_blank"
            >
              Open panel ↗
            </Link>
          </div>
        </div>

        {/* Actions */}
        <TenantActionsClient
          tenantId={tenant.id}
          currentStatus={tenant.status}
          trialEndsAt={tenant.trial_ends_at}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <InfoCard label="Reservations (30d)" value={reservations30d ?? 0} />
        <InfoCard label="Total reservations" value={reservationsTotal ?? 0} />
        <InfoCard label="Total guests" value={guestCount ?? 0} />
        <InfoCard label="Members" value={(members ?? []).length} />
      </div>

      {/* Tenant info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Account">
          <Row label="ID" value={<span className="font-mono text-xs text-offwhite/50">{tenant.id}</span>} />
          <Row label="Status" value={<StatusBadge status={tenant.status} />} />
          <Row label="Created" value={new Date(tenant.created_at).toLocaleString()} />
          {trialEnd && (
            <Row
              label="Trial ends"
              value={
                <span className={daysLeft !== null && daysLeft <= 0 ? 'text-red-400' : daysLeft !== null && daysLeft <= 7 ? 'text-gold' : 'text-offwhite/70'}>
                  {trialEnd.toLocaleDateString()}{daysLeft !== null ? ` (${daysLeft > 0 ? `${daysLeft}d left` : 'expired'})` : ''}
                </span>
              }
            />
          )}
          <Row label="Stripe customer" value={<span className="font-mono text-xs text-offwhite/50">{tenant.stripe_customer_id || '—'}</span>} />
          <Row label="Stripe subscription" value={<span className="font-mono text-xs text-offwhite/50">{tenant.stripe_subscription_id || '—'}</span>} />
        </Section>

        <Section title="Settings">
          {settings ? (
            <>
              <Row label="Restaurant name" value={settings.name} />
              <Row label="Timezone" value={settings.timezone} />
              <Row label="Notification email" value={settings.notification_email || '—'} />
              <Row label="Address" value={settings.address || '—'} />
              <Row label="Phone" value={settings.phone || '—'} />
              <Row label="AI enabled" value={settings.ai_enabled ? 'Yes' : 'No'} />
              <Row label="Stripe Connect" value={settings.stripe_account_id ? <span className="font-mono text-xs text-offwhite/50">{settings.stripe_account_id}</span> : '—'} />
            </>
          ) : (
            <p className="text-sm text-offwhite/30">No settings found.</p>
          )}
        </Section>
      </div>

      {/* Members */}
      <Section title="Members">
        {(members ?? []).length === 0 ? (
          <p className="text-sm text-offwhite/30">No members.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="pb-2 text-left text-xs text-offwhite/30 font-semibold uppercase tracking-widest">Email</th>
                <th className="pb-2 text-left text-xs text-offwhite/30 font-semibold uppercase tracking-widest">Name</th>
                <th className="pb-2 text-left text-xs text-offwhite/30 font-semibold uppercase tracking-widest">Role</th>
                <th className="pb-2 text-left text-xs text-offwhite/30 font-semibold uppercase tracking-widest">Joined</th>
              </tr>
            </thead>
            <tbody>
              {(members ?? []).map((m: any) => (
                <tr key={m.created_at} className="border-b border-white/[0.04]">
                  <td className="py-2.5 pr-4 text-offwhite/70">{m.profiles?.email ?? '—'}</td>
                  <td className="py-2.5 pr-4 text-offwhite/50">{m.profiles?.full_name ?? '—'}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${m.role === 'admin' ? 'bg-gold/12 text-gold border-gold/25' : 'bg-white/[0.06] text-offwhite/40 border-white/[0.08]'}`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="py-2.5 text-offwhite/30 text-xs">{new Date(m.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] p-5">
      <p className="text-xs font-semibold text-offwhite/30 uppercase tracking-widest mb-1">{label}</p>
      <p className="font-satoshi font-bold text-2xl text-offwhite">{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] p-6 space-y-4">
      <p className="text-xs font-semibold text-offwhite/30 uppercase tracking-widest">{title}</p>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-offwhite/40 shrink-0">{label}</span>
      <span className="text-offwhite/80 text-right">{value}</span>
    </div>
  )
}
