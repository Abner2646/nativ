'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { getTenantDomain, getTenantBaseUrl } from '@/lib/domain'

type NavItem = {
  href: string
  label: string
  exact?: boolean
  comingSoon?: boolean
  adminOnly?: boolean
} | '---'

const NAV = (slug: string): NavItem[] => [
  { href: `/restaurant/${slug}`,              label: 'Dashboard',      exact: true },
  { href: `/restaurant/${slug}/reservations`, label: 'Reservations' },
  { href: `/restaurant/${slug}/guests`,       label: 'Guests' },
  { href: `/restaurant/${slug}/campaigns`,    label: 'AI Campaigns',   comingSoon: true, adminOnly: true },
  '---',
  { href: `/restaurant/${slug}/shifts`,       label: 'Shifts',         adminOnly: true },
  { href: `/restaurant/${slug}/areas`,        label: 'Seating areas',  adminOnly: true },
  { href: `/restaurant/${slug}/events`,       label: 'Special events', adminOnly: true },
  { href: `/restaurant/${slug}/deposits`,     label: 'Deposits',       adminOnly: true },
  '---',
  { href: `/restaurant/${slug}/employees`,    label: 'Employees',      adminOnly: true },
  { href: `/restaurant/${slug}/photos`,       label: 'Photos',         adminOnly: true },
  { href: `/restaurant/${slug}/embed`,        label: 'Embed & share',  adminOnly: true },
  { href: `/restaurant/${slug}/settings`,     label: 'Settings',       adminOnly: true },
  { href: `/restaurant/${slug}/billing`,      label: 'Billing',        adminOnly: true },
]

export function Sidebar({
  slug, name, userEmail, role,
}: {
  slug: string
  name: string
  userEmail: string
  role: 'admin' | 'employee'
}) {
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
  const isAdmin = role === 'admin'

  const visibleNav = NAV(slug).filter(item => {
    if (item === '---') return true
    if (item.adminOnly && !isAdmin) return false
    return true
  })

  // Collapse consecutive separators and leading/trailing separators
  const cleanNav: NavItem[] = []
  for (const item of visibleNav) {
    if (item === '---') {
      if (cleanNav.length === 0) continue
      if (cleanNav[cleanNav.length - 1] === '---') continue
      cleanNav.push(item)
    } else {
      cleanNav.push(item)
    }
  }
  if (cleanNav[cleanNav.length - 1] === '---') cleanNav.pop()

  return (
    <aside className="w-60 flex flex-col fixed h-screen bg-midnight z-10"
      style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>

      {/* ── Header: restaurant + user avatar ── */}
      <div className="px-4 pt-3 pb-3.5 flex items-center justify-between gap-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="min-w-0">
          <Link
            href="/dashboard"
            className="text-[10px] text-offwhite/30 hover:text-offwhite/60 transition-colors flex items-center gap-1 mb-1.5 w-fit"
          >
            ← All restaurants
          </Link>
          <p className="font-satoshi font-bold text-offwhite truncate text-sm leading-tight">{name}</p>
          <p className="text-[10px] text-offwhite/25 mt-0.5 truncate">{getTenantDomain(slug)}</p>
        </div>

        {/* Avatar dropdown */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setOpen(v => !v)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-offwhite/60 transition-colors select-none"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
            aria-label="Account menu"
          >
            {initial}
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-xl shadow-2xl overflow-hidden z-50"
              style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-xs text-offwhite/35 truncate">{userEmail}</p>
                <span className={`mt-1 inline-block text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
                  isAdmin
                    ? 'bg-gold/12 text-gold border border-gold/25'
                    : 'bg-white/[0.06] text-offwhite/40 border border-white/[0.08]'
                }`}>
                  {role}
                </span>
              </div>
              <Link href="/account" onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-offwhite/60 hover:text-offwhite hover:bg-white/[0.04] transition-colors">
                My account
              </Link>
              <Link href="/dashboard" onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-offwhite/60 hover:text-offwhite hover:bg-white/[0.04] transition-colors">
                All restaurants
              </Link>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <form action="/api/auth/logout" method="POST">
                  <button className="w-full text-left px-3 py-2 text-sm text-red-400/80 hover:text-red-400 hover:bg-white/[0.04] transition-colors">
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
        {cleanNav.map((item, i) => {
          if (item === '---') {
            return <div key={i} className="my-1 mx-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} />
          }
          if (item.comingSoon) {
            return (
              <span key={item.href}
                className="flex items-center justify-between mx-2 px-3 py-2 rounded-lg text-sm text-offwhite/25 cursor-default select-none">
                {item.label}
                <span className="text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded text-offwhite/25"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  Soon
                </span>
              </span>
            )
          }
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link key={item.href} href={item.href}
              className={`block mx-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'text-offwhite font-medium'
                  : 'text-offwhite/50 hover:text-offwhite hover:bg-white/[0.04]'
              }`}
              style={active ? { backgroundColor: 'rgba(255,255,255,0.08)' } : undefined}>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* ── Footer: public page (admin only) or role badge (employee) ── */}
      <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {isAdmin ? (
          <a href={getTenantBaseUrl(slug)} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors group"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            onMouseOver={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)' }}
            onMouseOut={e  => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}>
            <div className="min-w-0">
              <p className="text-xs font-medium text-offwhite/60">Your public page</p>
              <p className="text-[10px] text-offwhite/25 truncate mt-0.5">{getTenantDomain(slug)}</p>
            </div>
            <span className="text-offwhite/25 ml-2 shrink-0 text-sm">↗</span>
          </a>
        ) : (
          <div className="px-3 py-2.5 rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-offwhite/25">Role</p>
            <p className="text-xs text-offwhite/40 mt-0.5">Employee</p>
          </div>
        )}
      </div>
    </aside>
  )
}
