// src/app/(app)/dashboard/page.tsx
import { requireUser } from '@/lib/auth'
import { getUserTenants } from '@/lib/auth'

export default async function DashboardPage() {
  const user = await requireUser()
  const tenants = await getUserTenants(user.id)

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-8 py-5 flex items-center justify-between">
        <h1 className="text-xl font-bold">Nativ</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{user.email}</span>
          <form action="/api/auth/logout" method="POST">
            <button className="text-sm text-gray-500 hover:text-white transition">Log out</button>
          </form>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Your restaurants</h2>
          <a href="/onboarding"
            className="bg-white text-black font-semibold px-5 py-2.5 rounded-lg text-sm hover:bg-gray-100 transition">
            + Add restaurant
          </a>
        </div>

        {tenants.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-6">You don't have any restaurants yet.</p>
            <a href="/onboarding" className="bg-white text-black font-semibold px-8 py-4 rounded-lg hover:bg-gray-100 transition">
              Create your first restaurant
            </a>
          </div>
        ) : (
          <div className="grid gap-4">
            {tenants.map((m: any) => {
              const tenant = m.tenants
              const settings = tenant?.tenant_settings?.[0]
              return (
                <a key={tenant?.id} href={`/restaurant/${tenant?.slug}`}
                  className="block bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-600 transition group">
                  <div className="flex items-center gap-4">
                    {settings?.logo_url ? (
                      <img src={settings.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center text-xl font-bold"
                        style={{ backgroundColor: settings?.primary_color || '#333' }}>
                        {settings?.name?.[0] || '?'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white group-hover:text-gray-100">{settings?.name || tenant?.slug}</p>
                      <p className="text-sm text-gray-500">{tenant?.slug}.nativ.com · {m.role}</p>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full ${tenant?.status === 'active' ? 'bg-green-900/50 text-green-400' : tenant?.status === 'trial' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-red-900/50 text-red-400'}`}>
                      {tenant?.status}
                    </div>
                    <svg className="text-gray-600 group-hover:text-gray-400 transition" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
