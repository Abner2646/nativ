import { requireSuperadmin } from '@/lib/auth'
import { BroadcastClient } from './BroadcastClient'

export default async function SuperadminBroadcastPage() {
  await requireSuperadmin()
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-satoshi font-bold text-2xl text-offwhite">Email Broadcast</h1>
        <p className="text-sm text-offwhite/35 mt-1">Send a message to all or a subset of tenants.</p>
      </div>
      <BroadcastClient />
    </div>
  )
}
