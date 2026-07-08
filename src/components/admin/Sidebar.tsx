'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { getTenantDomain, getTenantBaseUrl } from '@/lib/domain'
import {
  LayoutDashboard, CalendarDays, Users, Sparkles, Clock,
  CalendarRange, CreditCard, UserCog, Image, Code2, Settings,
  Receipt, ExternalLink, Table2, PanelLeftClose, PanelLeftOpen,
  type LucideIcon,
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
  // Seating areas se administra desde Floor plan (link en Edit layout)
  { href: `/restaurant/${slug}/floor-plan`,   label: 'Floor plan',     icon: Table2 },
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
  const [collapsed, setCollapsed] = useState(false)
  // Peek: expansión temporal por hover/focus. Nunca persiste — el pin es el toggle.
  const [peek, setPeek] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches

  const onSidebarEnter = () => {
    if (!collapsed || !canHover()) return
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null }
    if (!peek && !enterTimer.current) {
      enterTimer.current = setTimeout(() => { setPeek(true); enterTimer.current = null }, 250)
    }
  }
  const onSidebarLeave = () => {
    if (enterTimer.current) { clearTimeout(enterTimer.current); enterTimer.current = null }
    if (peek && !leaveTimer.current) {
      // Salida más lenta que la entrada: perdona el overshoot del mouse
      leaveTimer.current = setTimeout(() => { setPeek(false); leaveTimer.current = null }, 350)
    }
  }
  // Teclado: foco dentro del sidebar expande igual que el hover
  const onSidebarFocus = () => { if (collapsed) { if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null }; setPeek(true) } }
  const onSidebarBlur = (e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setPeek(false)
  }

  // Colapso persistente por dispositivo. La clase en <body> coordina
  // el margen del <main> (ver layout) sin levantar estado al server.
  useEffect(() => {
    setCollapsed(localStorage.getItem('nativ:sidebar-collapsed') === '1')
  }, [])

  const toggleCollapsed = () => {
    setPeek(false)
    if (enterTimer.current) { clearTimeout(enterTimer.current); enterTimer.current = null }
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null }
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('nativ:sidebar-collapsed', next ? '1' : '0')
      return next
    })
  }

  // Expandido visualmente = pineado abierto o peek activo
  const expanded = !collapsed || peek

  // El peek también comprime el contenido (no overlay): la clase del body
  // controla el margen del main, así que refleja "colapsado Y sin peek".
  useEffect(() => {
    document.body.classList.toggle('sidebar-collapsed', collapsed && !peek)
  }, [collapsed, peek])

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
    <>
    {/* ── Account — fijo arriba a la derecha, estilo Supabase ── */}
    <div className="fixed top-3 right-4 z-40" ref={menuRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-offwhite/70 transition-colors select-none shadow-lg"
        style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.14)' }}
        aria-label="Account menu"
      >
        {initial}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-52 rounded-xl shadow-2xl overflow-hidden z-50"
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

    {/* md: slim (60px), lg: full (240px). Colapsado + hover = peek en overlay */}
    <aside
      onMouseEnter={onSidebarEnter}
      onMouseLeave={onSidebarLeave}
      onFocusCapture={onSidebarFocus}
      onBlurCapture={onSidebarBlur}
      className={`hidden md:flex md:w-[60px] ${expanded ? 'lg:w-60' : ''} flex-col fixed h-screen bg-midnight transition-[width] duration-200 ease-out motion-reduce:transition-none overflow-x-hidden z-10`}
      style={{ borderRight: border }}
    >

      {/* ── Header: nombre + toggle de colapso (solo desktop) ── */}
      <div
        className={`hidden lg:flex items-center ${expanded ? 'justify-between px-4' : 'justify-center px-2'} pt-3 pb-3.5 gap-2`}
        style={{ borderBottom: border }}
      >
        <div className={expanded ? 'min-w-0' : 'hidden'}>
          <Link
            href="/dashboard"
            className="text-[10px] text-offwhite/30 hover:text-offwhite/60 transition-colors flex items-center gap-1 mb-1.5 w-fit"
          >
            ← All restaurants
          </Link>
          <p className="font-satoshi font-bold text-offwhite truncate text-sm leading-tight">{name}</p>
          <p className="text-[10px] text-offwhite/25 mt-0.5 truncate">{getTenantDomain(slug)}</p>
        </div>
        <button
          onClick={toggleCollapsed}
          title={collapsed ? 'Pin sidebar open' : 'Collapse sidebar'}
          className="p-1.5 rounded-lg text-offwhite/30 hover:text-offwhite/60 transition-colors shrink-0"
        >
          {/* El ícono sigue la PREFERENCIA (no el peek): durante el peek muestra
              "abrir" = anclar el sidebar expandido */}
          {collapsed ? <PanelLeftOpen size={15} strokeWidth={1.6} /> : <PanelLeftClose size={15} strokeWidth={1.6} />}
        </button>
      </div>

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
                className={`flex items-center gap-2.5 mx-1.5 px-1.5 py-3 md:justify-center ${expanded ? 'lg:justify-start lg:mx-2 lg:px-3 lg:py-2' : ''} rounded-lg text-sm text-offwhite/25 cursor-default select-none`}>
                <Icon size={15} strokeWidth={1.6} className="shrink-0" />
                <span className={expanded ? 'hidden lg:block flex-1 whitespace-nowrap' : 'hidden'}>{item.label}</span>
                <span className={`${expanded ? 'hidden lg:flex' : 'hidden'} text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded text-offwhite/25`}
                  style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>Soon</span>
              </span>
            )
          }

          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          const Icon   = item.icon
          const isReservations = item.href.endsWith('/reservations')
          const isBilling      = item.href.endsWith('/billing')

          return (
            <Link key={item.href} href={item.href} title={expanded ? undefined : item.label}
              className={`flex items-center gap-2.5 mx-1.5 px-1.5 py-3 md:justify-center ${expanded ? 'lg:justify-start lg:mx-2 lg:px-3 lg:py-2' : ''} rounded-lg text-sm transition-colors ${
                active ? 'text-offwhite font-medium' : 'text-offwhite/50 hover:text-offwhite hover:bg-white/[0.04]'
              }`}
              style={active ? { backgroundColor: 'rgba(255,255,255,0.08)' } : undefined}
            >
              <Icon size={15} strokeWidth={active ? 2 : 1.6} className={`shrink-0 ${active ? 'text-offwhite' : 'text-offwhite/40'}`} />
              <span className={expanded ? 'hidden lg:block flex-1 whitespace-nowrap' : 'hidden'}>{item.label}</span>

              {isReservations && todayCount > 0 && (
                <span className={`${expanded ? 'hidden lg:flex' : 'hidden'} text-[10px] font-bold px-1.5 py-0.5 rounded-full`}
                  style={{ backgroundColor: 'rgba(201,169,110,0.15)', color: '#C9A96E', border: '1px solid rgba(201,169,110,0.25)' }}>
                  {todayCount}
                </span>
              )}
              {isBilling && trialWarning && (
                <span className={`${expanded ? 'hidden lg:flex' : 'hidden'} text-[9px] font-bold px-1.5 py-0.5 rounded-full`}
                  style={{ backgroundColor: 'rgba(251,146,60,0.15)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.25)' }}>
                  {trialDaysLeft === 0 ? 'today' : `${trialDaysLeft}d`}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── Footer ── */}
      <div className={`p-2 ${expanded ? 'lg:p-3' : ''}`} style={{ borderTop: border }}>
        {isAdmin ? (
          <>
            {/* Slim: just an icon */}
            <div className={`${expanded ? 'lg:hidden flex' : 'flex'} justify-center`}>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                title="Your public page"
                className="p-2 rounded-lg text-offwhite/25 hover:text-offwhite/50 transition-colors">
                <ExternalLink size={15} />
              </a>
            </div>
            {/* Full */}
            <a href={publicUrl} target="_blank" rel="noopener noreferrer"
              className={`${expanded ? 'hidden lg:flex' : 'hidden'} items-center justify-between px-3 py-2.5 rounded-xl transition-colors`}
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
            <div className={`${expanded ? 'lg:hidden flex' : 'flex'} justify-center py-1`}>
              <span className="text-[9px] text-offwhite/20 uppercase tracking-widest font-semibold">E</span>
            </div>
            {/* Full */}
            <div className={`${expanded ? 'hidden lg:block' : 'hidden'} px-3 py-2.5 rounded-xl`}
              style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-offwhite/25">Role</p>
              <p className="text-xs text-offwhite/40 mt-0.5">Employee</p>
            </div>
          </>
        )}
      </div>
    </aside>
    </>
  )
}
