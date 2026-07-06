'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { getTenantDomain, getTenantBaseUrl } from '@/lib/domain'
import {
  LayoutDashboard, CalendarDays, Users, Sparkles, Clock, Armchair,
  CalendarRange, CreditCard, UserCog, Image, Code2, Settings,
  Receipt, ExternalLink, Search, type LucideIcon,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  exact?: boolean
  comingSoon?: boolean
  adminOnly?: boolean
} | '---'

const NAV = (slug: string): NavItem[] => [
  { href: `/restaurant/${slug}`,              label: 'Dashboard',      icon: LayoutDashboard, exact: true },
  { href: `/restaurant/${slug}/reservations`, label: 'Reservations',   icon: CalendarDays },
  { href: `/restaurant/${slug}/guests`,       label: 'Guests',         icon: Users },
  { href: `/restaurant/${slug}/campaigns`,    label: 'AI Campaigns',   icon: Sparkles,      comingSoon: true, adminOnly: true },
  '---',
  { href: `/restaurant/${slug}/shifts`,       label: 'Shifts',         icon: Clock,         adminOnly: true },
  { href: `/restaurant/${slug}/areas`,        label: 'Seating areas',  icon: Armchair,      adminOnly: true },
  { href: `/restaurant/${slug}/events`,       label: 'Special events', icon: CalendarRange, adminOnly: true },
  { href: `/restaurant/${slug}/deposits`,     label: 'Deposits',       icon: CreditCard,    adminOnly: true },
  '---',
  { href: `/restaurant/${slug}/employees`,    label: 'Employees',      icon: UserCog,       adminOnly: true },
  { href: `/restaurant/${slug}/photos`,       label: 'Photos',         icon: Image,         adminOnly: true },
  { href: `/restaurant/${slug}/embed`,        label: 'Embed & share',  icon: Code2,         adminOnly: true },
  { href: `/restaurant/${slug}/settings`,     label: 'Settings',       icon: Settings,      adminOnly: true },
  { href: `/restaurant/${slug}/billing`,      label: 'Billing',        icon: Receipt,       adminOnly: true },
]

function daysUntil(isoDate: string): number {
  const diff = new Date(isoDate).getTime() - Date.now()
  return Math.ceil(diff / 86_400_000)
}

export function Sidebar({
  slug, name, userEmail, role, todayCount = 0, trialEndsAt = null,
}: {
  slug: string
  name: string
  userEmail: string
  role: 'admin' | 'employee'
  todayCount?: number
  trialEndsAt?: string | null
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const initial = (userEmail?.[0] ?? '?').toUpperCase()
  const isAdmin = role === 'admin'
  const trialDaysLeft = trialEndsAt ? daysUntil(trialEndsAt) : null
  const trialWarning  = trialDaysLeft !== null && trialDaysLeft <= 3

  const visibleNav = NAV(slug).filter(item => {
    if (item === '---') return true
    if (item.adminOnly && !isAdmin) return false
    return true
  })

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

      {/* ── Header ── */}
      <div className="px-4 pt-3 pb-3.5 flex items-center justify-between gap-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="min-w-0">
          <Link href="/dashboard"
            className="text-[10px] text-offwhite/30 hover:text-offwhite/60 transition-colors flex items-center gap-1 mb-1.5 w-fit">
            ← All restaurants
          </Link>
          <p className="font-satoshi font-bold text-offwhite truncate text-sm leading-tight">{name}</p>
          <p className="text-[10px] text-offwhite/25 mt-0.5 truncate">{getTenantDomain(slug)}</p>
        </div>

        <div className="relative shrink-0" ref={menuRef}>
          <button onClick={() => setOpen(v => !v)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-offwhite/60 transition-colors select-none"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
            aria-label="Account menu">
            {initial}
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-xl shadow-2xl overflow-hidden z-50"
              style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-xs text-offwhite/35 truncate">{userEmail}</p>
                <span className={`mt-1 inline-block text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
                  isAdmin ? 'bg-gold/12 text-gold border border-gold/25' : 'bg-white/[0.06] text-offwhite/40 border border-white/[0.08]'
                }`}>{role}</span>
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

      {/* ── Search shortcut ── */}
      <button
        onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
        className="mx-3 mt-2.5 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-offwhite/30 hover:text-offwhite/50 transition-colors"
        style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <Search size={12} />
        <span className="flex-1 text-left">Search guests…</span>
        <kbd className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)' }}>
          ⌘K
        </kbd>
      </button>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-2 mt-1">
        {cleanNav.map((item, i) => {
          if (item === '---') {
            return <div key={i} className="my-1 mx-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} />
          }
          if (item.comingSoon) {
            const Icon = item.icon
            return (
              <span key={item.href}
                className="flex items-center justify-between mx-2 px-3 py-2 rounded-lg text-sm text-offwhite/25 cursor-default select-none">
                <span className="flex items-center gap-2.5"><Icon size={15} strokeWidth={1.6} />{item.label}</span>
                <span className="text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded text-offwhite/25"
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>Soon</span>
              </span>
            )
          }

          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          const Icon   = item.icon
          const isReservations = item.href.endsWith('/reservations')
          const isBilling      = item.href.endsWith('/billing')

          return (
            <Link key={item.href} href={item.href} title={item.label}
              className={`flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                active ? 'text-offwhite font-medium' : 'text-offwhite/50 hover:text-offwhite hover:bg-white/[0.04]'
              }`}
              style={active ? { backgroundColor: 'rgba(255,255,255,0.08)' } : undefined}>
              <Icon size={15} strokeWidth={active ? 2 : 1.6} className={active ? 'text-offwhite' : 'text-offwhite/40'} />
              <span className="flex-1">{item.label}</span>

              {/* Today's reservation badge */}
              {isReservations && todayCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgba(201,169,110,0.15)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.25)' }}>
                  {todayCount}
                </span>
              )}

              {/* Trial warning badge */}
              {isBilling && trialWarning && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.25)' }}>
                  {trialDaysLeft === 0 ? 'today' : `${trialDaysLeft}d`}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {isAdmin ? (
          <a href={getTenantBaseUrl(slug)} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
            onMouseOver={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)' }}
            onMouseOut={e  => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}>
            <div className="min-w-0">
              <p className="text-xs font-medium text-offwhite/60">Your public page</p>
              <p className="text-[10px] text-offwhite/25 truncate mt-0.5">{getTenantDomain(slug)}</p>
            </div>
            <ExternalLink size={13} className="text-offwhite/25 ml-2 shrink-0" />
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
