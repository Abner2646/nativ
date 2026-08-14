'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { Search, X, CalendarDays, Users } from 'lucide-react'

const AVATAR_PALETTE = [
  { bg: 'rgba(201,169,110,0.18)', color: '#C9A96E' },
  { bg: 'rgba(111,143,123,0.18)', color: '#86BBA7' },
  { bg: 'rgba(130,150,200,0.18)', color: '#8296C8' },
  { bg: 'rgba(200,130,130,0.18)', color: '#C88282' },
  { bg: 'rgba(160,130,200,0.18)', color: '#A082C8' },
]
function getInitials(name: string) {
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}
function getAvatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length]
}

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

interface Result {
  id: string
  primary: string
  secondary: string
  href: string
}

interface Props { slug: string }

export function GlobalSearch({ slug }: Props) {
  const [open, setOpen]           = useState(false)
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<Result[]>([])
  const [loading, setLoading]     = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(v => !v) }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 40); setQuery(''); setResults([]) }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(
        `/api/admin?resource=guests&search=${encodeURIComponent(q)}&tenant=${slug}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      setResults(
        (data.guests || []).slice(0, 6).map((g: any) => ({
          id: g.id,
          primary: g.name,
          secondary: `${g.email}${g.visit_count ? ` · ${g.visit_count} visit${g.visit_count !== 1 ? 's' : ''}` : ''}`,
          href: `/restaurant/${slug}/guests?guest=${g.id}`,
        }))
      )
      setActiveIdx(0)
    } finally { setLoading(false) }
  }, [slug])

  useEffect(() => {
    const t = setTimeout(() => search(query), 220)
    return () => clearTimeout(t)
  }, [query, search])

  const go = (href: string) => { router.push(href); setOpen(false) }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[activeIdx]) go(results[activeIdx].href)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 30px 80px rgba(0,0,0,0.55)' }}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Search size={15} className="text-offwhite/30 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search guests by name or email…"
            className="flex-1 bg-transparent text-offwhite text-sm outline-none placeholder:text-offwhite/25"
          />
          {loading
            ? <span className="text-[10px] text-offwhite/25 shrink-0">Searching…</span>
            : <button onClick={() => setOpen(false)} className="text-offwhite/25 hover:text-offwhite/60 transition-colors"><X size={14} /></button>
          }
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ul className="py-1.5">
            {results.map((r, i) => (
              <li key={r.id}>
                <button
                  onClick={() => go(r.href)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                  style={{ backgroundColor: i === activeIdx ? 'rgba(255,255,255,0.05)' : 'transparent' }}
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold"
                    style={{ backgroundColor: getAvatarColor(r.primary).bg, color: getAvatarColor(r.primary).color }}>
                    {getInitials(r.primary)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-offwhite truncate">{r.primary}</p>
                    <p className="text-xs text-offwhite/40 truncate">{r.secondary}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {query && !loading && results.length === 0 && (
          <p className="text-sm text-offwhite/30 text-center px-4 py-6">No results for "{query}"</p>
        )}

        {!query && (
          <div className="px-3 py-3">
            <p className="text-[10px] text-offwhite/20 uppercase tracking-widest px-1 mb-1.5">Jump to</p>
            {[
              { icon: CalendarDays, label: "Today's reservations", href: `/restaurant/${slug}/reservations` },
              { icon: Users, label: 'All guests', href: `/restaurant/${slug}/guests` },
            ].map(({ icon: Icon, label, href }) => (
              <button key={href} onClick={() => go(href)}
                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors hover:bg-white/[0.04]">
                <Icon size={13} className="text-offwhite/30 shrink-0" />
                <span className="text-sm text-offwhite/45">{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {[['↑↓', 'navigate'], ['↵', 'open'], ['Esc', 'close']].map(([key, label]) => (
            <span key={key} className="flex items-center gap-1 text-[10px] text-offwhite/20">
              <kbd className="px-1.5 py-0.5 rounded text-[9px]"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {key}
              </kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
