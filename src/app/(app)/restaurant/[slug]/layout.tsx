import { requireUser, getTenantBySlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { Sidebar } from '@/components/admin/Sidebar'

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

  const { data: settings } = await supabaseAdmin
    .from('tenant_settings')
    .select('name')
    .eq('tenant_id', access.tenant.id)
    .single()

  return (
    <div className="min-h-screen bg-midnight text-offwhite flex">
      <Sidebar slug={slug} name={settings?.name || slug} userEmail={user.email ?? ''} role={access.role} />
      <main className="ml-60 flex-1 min-h-screen">
        {children}
      </main>
    </div>
  )
}
