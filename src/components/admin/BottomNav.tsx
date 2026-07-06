'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarDays, Users, Menu } from 'lucide-react'

const NAV_ITEMS = (slug: string) => [
  { href: `/restaurant/${slug}`,              label: 'Home',         icon: LayoutDashboard, exact: true },
  { href: `/restaurant/${slug}/reservations`, label: 'Reservations', icon: CalendarDays },
  { href: `/restaurant/${slug}/guests`,       label: 'Guests',       icon: Users },
  { href: `/restaurant/${slug}/settings`,     label: 'More',         icon: Menu },
]

export function BottomNav({ slug, todayCount = 0 }: { slug: string; todayCount?: number }) {
  const pathname = usePathname()

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-20 flex items-stretch"
      style={{
        backgroundColor: '#0d1b2a',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {NAV_ITEMS(slug).map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        const isReservations = href.endsWith('/reservations')
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors"
            style={{ color: active ? '#F2EFE9' : 'rgba(242,239,233,0.35)' }}
          >
            <div className="relative">
              <Icon size={22} strokeWidth={active ? 2 : 1.6} />
              {isReservations && todayCount > 0 && (
                <span
                  className="absolute -top-1 -right-2 text-[9px] font-bold px-1 rounded-full"
                  style={{ backgroundColor: '#C9A96E', color: '#0d1b2a', minWidth: '14px', textAlign: 'center' }}
                >
                  {todayCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
