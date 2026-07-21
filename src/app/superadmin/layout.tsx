import { requireSuperadmin } from '@/lib/auth'
import Link from 'next/link'

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSuperadmin()

  return (
    <div className="min-h-screen bg-midnight text-offwhite">
      <header className="sticky top-0 z-40 flex items-center gap-6 px-6 py-3 border-b border-white/[0.07] bg-midnight/90 backdrop-blur-sm">
        <span className="font-satoshi font-bold text-sm text-offwhite/30 tracking-widest uppercase select-none">
          Nativ · Superadmin
        </span>
        <nav className="flex items-center gap-1">
          <NavLink href="/superadmin">Overview</NavLink>
          <NavLink href="/superadmin/tenants">Tenants</NavLink>
          <NavLink href="/superadmin/users">Users</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <Link href="/dashboard" className="text-xs text-offwhite/30 hover:text-offwhite/60 transition-colors">
            ← Back to panel
          </Link>
          <span className="text-xs text-offwhite/20">{user.email}</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-lg text-sm text-offwhite/50 hover:text-offwhite hover:bg-white/[0.06] transition-all"
    >
      {children}
    </Link>
  )
}
