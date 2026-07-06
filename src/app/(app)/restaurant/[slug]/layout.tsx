import { requireUser, getTenantBySlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { Sidebar } from '@/components/admin/Sidebar'
import { GlobalSearch } from '@/components/admin/GlobalSearch'

export default async function RestaurantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const user = await requireUser()
  const access = await getTenantBySlug(slug, user.id)
  if (!access) return notFound()

  const { tenant } = access
  const today = new Date().toISOString().split('T')[0]

  const [{ data: settings }, { count: todayCount }] = await Promise.all([
    supabaseAdmin.from('tenant_settings').select('name').eq('tenant_id', tenant.id).single(),
    supabaseAdmin.from('reservations').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id).eq('date', today).eq('status', 'confirmed'),
  ])

  return (
    <div className="min-h-screen bg-midnight text-offwhite flex">
      <Sidebar
        slug={slug}
        name={settings?.name || slug}
        userEmail={user.email ?? ''}
        role={access.role}
        todayCount={todayCount ?? 0}
        trialEndsAt={tenant.status === 'trial' ? (tenant.trial_ends_at ?? null) : null}
      />
      <main className="ml-60 flex-1 min-h-screen">
        {children}
      </main>
      <GlobalSearch slug={slug} />
    </div>
  )
}
