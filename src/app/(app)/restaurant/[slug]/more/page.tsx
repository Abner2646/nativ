import { requireUser, requireAdminForSlug } from '@/lib/auth'
import { getTenantBaseUrl } from '@/lib/domain'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  Clock, Armchair, CalendarRange, CreditCard,
  Settings, Image, Code2, Sparkles,
  UserCog, Receipt, Gift, ExternalLink, Table2,
} from 'lucide-react'

const SECTIONS = (slug: string) => [
  {
    label: 'Manage',
    items: [
      { href: `/restaurant/${slug}/shifts`,   icon: Clock,          label: 'Shifts',         desc: 'Service hours and slot capacity',    comingSoon: false },
      { href: `/restaurant/${slug}/areas`,    icon: Armchair,       label: 'Seating areas',  desc: 'Configure your areas and zones',     comingSoon: false },
      { href: `/restaurant/${slug}/floor-plan`, icon: Table2,       label: 'Floor plan',     desc: 'Draw your dining room and tables',   comingSoon: false },
      { href: `/restaurant/${slug}/events`,   icon: CalendarRange,  label: 'Special events', desc: 'Events and blocked dates',           comingSoon: false },
      { href: `/restaurant/${slug}/deposits`, icon: CreditCard,     label: 'Deposits',       desc: 'Deposit rules and Stripe Connect',   comingSoon: false },
    ],
  },
  {
    label: 'Customize',
    items: [
      { href: `/restaurant/${slug}/settings`,  icon: Settings,  label: 'Settings',      desc: 'Name, timezone, booking rules',       comingSoon: false },
      { href: `/restaurant/${slug}/photos`,    icon: Image,     label: 'Photos',        desc: 'Logo and photo gallery',              comingSoon: false },
      { href: `/restaurant/${slug}/embed`,     icon: Code2,     label: 'Embed & share', desc: 'Widget, links and branding',          comingSoon: false },
      { href: `/restaurant/${slug}/campaigns`, icon: Sparkles,  label: 'AI Campaigns',  desc: 'Automated marketing campaigns',       comingSoon: true  },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: `/restaurant/${slug}/employees`, icon: UserCog, label: 'Employees', desc: 'Team members and invites',    comingSoon: false },
      { href: `/restaurant/${slug}/billing`,   icon: Receipt, label: 'Billing',   desc: 'Plan and subscription',      comingSoon: false },
      { href: `/restaurant/${slug}/referrals`, icon: Gift,    label: 'Referrals', desc: 'Refer other restaurants',    comingSoon: false },
    ],
  },
]

const cardBg = { backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }

export default async function MorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const user = await requireUser()
  const access = await requireAdminForSlug(slug, user.id)
  if (!access) return notFound()

  const publicUrl = getTenantBaseUrl(slug)

  return (
    <div className="p-4 md:p-8 pb-24">
      <h1 className="font-satoshi font-bold text-[22px] text-offwhite mb-6">More</h1>

      <div className="space-y-6">
        {SECTIONS(slug).map(section => (
          <div key={section.label}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-offwhite/30 mb-2 px-1">
              {section.label}
            </p>
            <div className="rounded-2xl overflow-hidden" style={cardBg}>
              {section.items.map((item, i) => {
                const Icon = item.icon
                const borderStyle = i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.05)' } : undefined
                if (item.comingSoon) {
                  return (
                    <div
                      key={item.href}
                      className="flex items-center gap-4 px-4 py-4 opacity-40 cursor-default select-none"
                      style={borderStyle}
                    >
                      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <Icon size={16} strokeWidth={1.6} className="text-offwhite/40" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-offwhite/60">{item.label}</p>
                          <span className="text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded text-offwhite/40"
                            style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}>Soon</span>
                        </div>
                        <p className="text-xs text-offwhite/30 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  )
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-white/[0.03] active:bg-white/[0.06]"
                    style={borderStyle}
                  >
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <Icon size={16} strokeWidth={1.6} className="text-offwhite/60" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-offwhite">{item.label}</p>
                      <p className="text-xs text-offwhite/40 mt-0.5">{item.desc}</p>
                    </div>
                    <span className="text-offwhite/25 text-sm shrink-0">›</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        {/* Public page link */}
        <a href={publicUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-between px-4 py-4 rounded-2xl transition-colors hover:bg-white/[0.03]"
          style={cardBg}>
          <div className="flex items-center gap-4">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(201,169,110,0.10)', border: '1px solid rgba(201,169,110,0.20)' }}>
              <ExternalLink size={16} strokeWidth={1.6} className="text-gold" />
            </span>
            <div>
              <p className="text-sm font-medium text-offwhite">Your public page</p>
              <p className="text-xs text-offwhite/40 mt-0.5">Open reservation widget in a new tab</p>
            </div>
          </div>
          <span className="text-offwhite/25 text-sm">›</span>
        </a>
      </div>
    </div>
  )
}
