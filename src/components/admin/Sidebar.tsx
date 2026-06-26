'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = (slug: string) => [
  { href: `/restaurant/${slug}`, label: 'Dashboard', exact: true },
  { href: `/restaurant/${slug}/reservations`, label: 'Reservations' },
  { href: `/restaurant/${slug}/guests`, label: 'Guests' },
  { href: `/restaurant/${slug}/campaigns`, label: 'AI Campaigns' },
  { href: `/restaurant/${slug}/shifts`, label: 'Shifts' },
  { href: `/restaurant/${slug}/areas`, label: 'Seating Areas' },
  { href: `/restaurant/${slug}/events`, label: 'Special Events' },
  { href: `/restaurant/${slug}/employees`, label: 'Employees' },
  { href: `/restaurant/${slug}/referrals`, label: 'Referrals' },
  { href: `/restaurant/${slug}/settings`, label: 'Settings' },
]

export function Sidebar({ slug, name }: { slug: string; name: string }) {
  const pathname = usePathname()

  return (
    <aside className="w-64 border-r border-gray-800 flex flex-col fixed h-screen bg-gray-950 z-10">
      <div className="p-6 border-b border-gray-800">
        <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-300 transition block mb-3">
          ← All restaurants
        </Link>
        <p className="font-bold text-white truncate">{name}</p>
        <p className="text-xs text-gray-500 mt-1">{slug}.nativ.com</p>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV(slug).map(item => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-2.5 rounded-lg text-sm transition ${
                active ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-gray-800">
        <a
          href={`https://${slug}.nativ.com`}
          target="_blank"
          rel="noopener noreferrer"
          className="block px-4 py-2.5 rounded-lg text-sm text-gray-500 hover:text-white hover:bg-gray-800 transition"
        >
          View public page ↗
        </a>
      </div>
    </aside>
  )
}
