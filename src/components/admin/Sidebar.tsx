'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { getTenantDomain, getTenantBaseUrl } from '@/lib/domain'

type NavItem = { href: string; label: string; exact?: boolean; comingSoon?: boolean } | '---'

const NAV = (slug: string): NavItem[] => [
  { href: `/restaurant/${slug}`,              label: 'Dashboard',     exact: true },
  { href: `/restaurant/${slug}/reservations`, label: 'Reservations' },
  { href: `/restaurant/${slug}/guests`,       label: 'Guests' },
  { href: `/restaurant/${slug}/campaigns`,    label: 'AI Campaigns',  comingSoon: true },
  '---',
  { href: `/restaurant/${slug}/shifts`,       label: 'Shifts' },
  { href: `/restaurant/${slug}/areas`,        label: 'Seating areas' },
  { href: `/restaurant/${slug}/events`,       label: 'Special events' },
  '---',
  { href: `/restaurant/${slug}/employees`,    label: 'Employees' },
  { href: `/restaurant/${slug}/photos`,       label: 'Photos' },
  { href: `/restaurant/${slug}/embed`,        label: 'Embed & share' },
  { href: `/restaurant/${slug}/settings`,     label: 'Settings' },
  { href: `/restaurant/${slug}/billing`,      label: 'Billing' },
]

export function Sidebar({ slug, name, userEmail }: { slug: string; name: string; userEmail: string }) {
  const pathname  = usePathname()
  const [open, setOpen] = useState(false)
  const menuRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const initial = (userEmail?.[0] ?? '?').toUpperCase()

  return (
    <aside className="w-60 border-r border-gray-800 flex flex-col fixed h-screen bg-gray-950 z-10">

      {/* ── Header: restaurant + user avatar ── */}
      <div className="px-4 py-3.5 border-b border-gray-800 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-white truncate text-sm leading-tight">{name}</p>
          <p className="text-[10px] text-gray-600 mt-0.5 truncate">{getTenantDomain(slug)}</p>
        </div>

        {/* Avatar dropdown */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setOpen(v => !v)}
            className="w-7 h-7 rounded-full bg-gray-800 hover:bg-gray-700 border border-gray-700 flex items-center justify-center text-xs font-semibold text-gray-300 transition select-none"
            aria-label="Account menu"
          >
            {initial}
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50">
              <div className="px-3 py-2.5 border-b border-gray-800">
                <p className="text-xs text-gray-500 truncate">{userEmail}</p>
              </div>
              <Link href="/account" onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800/70 transition">
                My account
              </Link>
              <Link href="/dashboard" onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800/70 transition">
                All restaurants
              </Link>
              <div className="border-t border-gray-800">
                <form action="/api/auth/logout" method="POST">
                  <button className="w-full text-left px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800/70 transition">
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV(slug).map((item, i) => {
          if (item === '---') {
            return <div key={i} className="my-1 mx-3 border-t border-gray-800/50" />
          }
          if (item.comingSoon) {
            return (
              <span key={item.href}
                className="flex items-center justify-between mx-2 px-3 py-2 rounded-md text-sm text-gray-600 cursor-default select-none">
                {item.label}
                <span className="text-[9px] font-semibold uppercase tracking-widest bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">
                  Soon
                </span>
              </span>
            )
          }
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={`block mx-2 px-3 py-2 rounded-md text-sm transition ${
                active
                  ? 'bg-gray-800 text-white font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
              }`}>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* ── Footer: public page ── */}
      <div className="p-3 border-t border-gray-800">
        <a href={getTenantBaseUrl(slug)} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 transition group">
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-300 group-hover:text-white transition">Your public page</p>
            <p className="text-[10px] text-gray-600 truncate mt-0.5">{getTenantDomain(slug)}</p>
          </div>
          <span className="text-gray-600 group-hover:text-gray-400 transition ml-2 shrink-0 text-sm">↗</span>
        </a>
      </div>
    </aside>
  )
}
