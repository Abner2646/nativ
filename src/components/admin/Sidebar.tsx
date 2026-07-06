'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { getTenantDomain, getTenantBaseUrl } from '@/lib/domain'
import {
  LayoutDashboard, CalendarDays, Users, Sparkles, Clock, Armchair,
  CalendarRange, CreditCard, UserCog, Image, Code2, Settings,
  Receipt, ExternalLink, Search, Table2, type LucideIcon,
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
  { href: `/restaurant/${slug}/tables`,       label: 'Tables',         icon: Table2,        comingSoon: true, adminOnly: true },
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
  const publicUrl = getTenantBaseUrl(slug)

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

  const border = '1px solid rgba(255,255,255,0.06)'

  return (
    // md: slim (60px), lg: full (240px)
    <aside
      className="hidden md:flex md:w-[60px] lg:w-60 flex-col fixed h-screen bg-midnight z-10 transition-[width]"
      style={{ borderRight: border }}
    >

      {/* ── Header ── */}
      <div
        className="flex items-center justify-center lg:justify-between px-2 lg:px-4 pt-3 pb-3.5 gap-2"
        style={{ borderBottom: border }}
      >
        {/* Restaurant name + back link — hidden on slim */}
        <div className="hidden lg:block min-w-0">
          <Link
            href="/dashboard"
            className="text-[10px] text-offwhite/30 hover:text-offwhite/60 transition-colors flex items-center gap-1 mb-1.5 w-fit"
          >
            ← All restaurants
          </Link>
          <p className="font-satoshi font-bold text-offwhite truncate text-sm leading-tight">{name}</p>
          <p className="text-[10px] text-offwhite/25 mt-0.5 truncate">{getTenantDomain(slug)}</p>
        </div>

        {/* Avatar — always shown */}
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
            <div
              className="absolute left-0 lg:right-0 lg:left-auto top-full mt-2 w-52 rounded-xl shadow-2xl overflow-hidden z-50"
              style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="px-3 py-2.5" style={{ borderBottom: border }}>
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
              <div style={{ borderTop: border }}>
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

      {/* ── Search shortcut — hidden on slim ── */}
      <button
        onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))}
        className="hidden lg:flex mx-3 mt-2.5 items-center gap-2 px-3 py-2 rounded-lg text-xs text-offwhite/30 hover:text-offwhite/50 transition-colors"
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
            return (
              <div key={i} className="my-1 mx-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }} />
            )
          }

          if (item.comingSoon) {
            const Icon = item.icon
            return (
              <span key={item.href}
                className="flex items-center gap-2.5 mx-1.5 px-1.5 py-3 md:justify-center lg:justify-start lg:mx-2 lg:px-3 lg:py-2 rounded-lg text-sm text-offwhite/25 cursor-default select-none">
                <Icon size={15} strokeWidth={1.6} className="shrink-0" />
                <span className="hidden lg:block flex-1">{item.label}</span>
                <span className="hidden lg:flex text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded text-offwhite/25"
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
              className={`flex items-center gap-2.5 mx-1.5 px-1.5 py-3 md:justify-center lg:justify-start lg:mx-2 lg:px-3 lg:py-2 rounded-lg text-sm transition-colors ${
                active ? 'text-offwhite font-medium' : 'text-offwhite/50 hover:text-offwhite hover:bg-white/[0.04]'
              }`}
              style={active ? { backgroundColor: 'rgba(255,255,255,0.08)' } : undefined}
            >
              <Icon size={15} strokeWidth={active ? 2 : 1.6} className={`shrink-0 ${active ? 'text-offwhite' : 'text-offwhite/40'}`} />
              <span className="hidden lg:block flex-1">{item.label}</span>

              {isReservations && todayCount > 0 && (
                <span className="hidden lg:flex text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgba(201,169,110,0.15)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.25)' }}>
                  {todayCount}
                </span>
              )}
              {isBilling && trialWarning && (
                <span className="hidden lg:flex text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.25)' }}>
                  {trialDaysLeft === 0 ? 'today' : `${trialDaysLeft}d`}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Footer ── */}
      <div className="p-2 lg:p-3" style={{ borderTop: border }}>
        {isAdmin ? (
          <>
            {/* Slim: just an icon */}
            <div className="lg:hidden flex justify-center">
              <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                title="Your public page"
                className="p-2 rounded-lg text-offwhite/25 hover:text-offwhite/50 transition-colors">
                <ExternalLink size={15} />
              </a>
            </div>
            {/* Full */}
            <a href={publicUrl} target="_blank" rel="noopener noreferrer"
              className="hidden lg:flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              onMouseOver={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)' }}
              onMouseOut={e  => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}>
              <div className="min-w-0">
                <p className="text-xs font-medium text-offwhite/60">Your public page</p>
                <p className="text-[10px] text-offwhite/25 truncate mt-0.5">{getTenantDomain(slug)}</p>
              </div>
              <ExternalLink size={13} className="text-offwhite/25 ml-2 shrink-0" />
            </a>
          </>
        ) : (
          <>
            {/* Slim: tiny "E" indicator */}
            <div className="lg:hidden flex justify-center py-1">
              <span className="text-[9px] text-offwhite/20 uppercase tracking-widest font-semibold">E</span>
            </div>
            {/* Full */}
            <div className="hidden lg:block px-3 py-2.5 rounded-xl"
              style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-offwhite/25">Role</p>
              <p className="text-xs text-offwhite/40 mt-0.5">Employee</p>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
