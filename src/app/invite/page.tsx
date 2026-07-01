import { supabaseAdmin } from '@/lib/supabase'
import { InviteClient } from '@/components/InviteClient'

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Invalid link</h1>
          <p className="text-gray-400">This invite link is missing a token.</p>
        </div>
      </main>
    )
  }

  const { data: invite } = await supabaseAdmin
    .from('employee_invites')
    .select('email, expires_at, tenant:tenants(slug, tenant_settings(name))')
    .eq('token', token)
    .maybeSingle()

  if (!invite) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Invite not found</h1>
          <p className="text-gray-400">This link is invalid or has already been used.</p>
        </div>
      </main>
    )
  }

  if (new Date(invite.expires_at) < new Date()) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Invite expired</h1>
          <p className="text-gray-400">Ask the restaurant to send you a new invite.</p>
        </div>
      </main>
    )
  }

  const tenant = invite.tenant as any
  const settings = tenant?.tenant_settings?.[0]
  const restaurantName = settings?.name || tenant?.slug || 'Restaurant'
  const slug = tenant?.slug || ''

  return (
    <InviteClient
      token={token}
      email={invite.email}
      restaurantName={restaurantName}
      slug={slug}
    />
  )
}
