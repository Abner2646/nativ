import { requireUser, getTenantBySlug } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { EmployeesClient } from '@/components/admin/EmployeesClient'

export default async function EmployeesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  const access = await getTenantBySlug(slug, user.id)
  if (!access) return notFound()

  const { tenant } = access

  const { data: employees } = await supabaseAdmin
    .from('tenant_members')
    .select('*, profiles(id, email, full_name)')
    .eq('tenant_id', tenant.id)
    .order('created_at')

  const { data: pendingInvites } = await supabaseAdmin
    .from('employee_invites')
    .select('id, email, expires_at, created_at')
    .eq('tenant_id', tenant.id)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-8">Employees</h1>
      <EmployeesClient
        initialEmployees={employees || []}
        initialInvites={pendingInvites || []}
        currentUserId={user.id}
        slug={slug}
      />
    </div>
  )
}
