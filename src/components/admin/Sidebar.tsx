'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SECTIONS = (slug: string) => [
  {
    label: 'My restaurant',
    items: [
      { href: `/restaurant/${slug}`,              label: 'Dashboard',     exact: true },
      { href: `/restaurant/${slug}/reservations`, label: 'Reservations' },
      { href: `/restaurant/${slug}/guests`,       label: 'Guests' },
      { href: `/restaurant/${slug}/campaigns`,    label: 'AI Campaigns',  comingSoon: true },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: `/restaurant/${slug}/shifts`,   label: 'Shifts' },
      { href: `/restaurant/${slug}/areas`,    label: 'Seating areas' },
      { href: `/restaurant/${slug}/events`,   label: 'Special events' },
    ],
  },
  {
    label: 'Team & growth',
    items: [
      { href: `/restaurant/${slug}/employees`, label: 'Employees' },
      { href: `/restaurant/${slug}/referrals`, label: 'Referrals' },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: `/restaurant/${slug}/photos`,   label: 'Photos' },
      { href: `/restaurant/${slug}/embed`,    label: 'Embed & share' },
      { href: `/restaurant/${slug}/billing`,  label: 'Billing' },
      { href: `/restaurant/${slug}/settings`, label: 'Settings' },
    ],
  },
]

export function Sidebar({ slug, name }: { slug: string; name: string }) {
  const pathname = usePathname()

  return (
    <aside className="w-60 border-r border-gray-800 flex flex-col fixed h-screen bg-gray-950 z-10">
      {/* Restaurant header */}
      <div className="p-5 border-b border-gray-800">
        <Link href="/dashboard" className="text-xs text-gray-600 hover:text-gray-400 transition block mb-3">
          ← All restaurants
        </Link>
        <p className="font-bold text-white truncate text-sm">{name}</p>
        <p className="text-xs text-gray-600 mt-0.5">{slug}.nativ.com</p>
      </div>

      {/* Sectioned nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {SECTIONS(slug).map(section => (
          <div key={section.label} className="mb-1">
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest px-5 py-2">
              {section.label}
            </p>
            {section.items.map(item => {
              if (item.comingSoon) {
                return (
                  <span
                    key={item.href}
                    className="flex items-center justify-between mx-2 px-3 py-2 rounded-md text-sm text-gray-600 cursor-default select-none"
                  >
                    {item.label}
                    <span className="text-[9px] font-semibold uppercase tracking-widest bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">
                      Soon
                    </span>
                  </span>
                )
              }
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block mx-2 px-3 py-2 rounded-md text-sm transition ${
                    active
                      ? 'bg-gray-800 text-white font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-800">
        <a
          href={`/?tenant=${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block px-3 py-2 rounded-md text-xs text-gray-500 hover:text-white hover:bg-gray-800 transition"
        >
          View public page ↗
        </a>
      </div>
    </aside>
  )
}
