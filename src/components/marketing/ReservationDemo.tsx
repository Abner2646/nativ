'use client'
import { useState, useEffect, useRef } from 'react'

const C = {
  midnight: '#0F1720',
  card:     '#162232',
  sage:     '#6F8F7B',
  gold:     '#C9A96E',
  offwhite: '#F2EFE9',
  border:   'rgba(255,255,255,0.06)',
}

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  confirmed: { bg: 'rgba(111,143,123,0.15)', color: '#6F8F7B', border: 'rgba(111,143,123,0.30)' },
  completed: { bg: 'rgba(255,255,255,0.06)', color: 'rgba(242,239,233,0.40)', border: 'rgba(255,255,255,0.08)' },
  cancelled: { bg: 'rgba(224,85,85,0.10)',   color: '#e05555',               border: 'rgba(224,85,85,0.20)' },
}

interface Res {
  id: number; time: string; name: string; email: string
  party: number; shift: string; status: 'confirmed' | 'completed' | 'cancelled'
  occasion?: string; notes?: string; isNew?: boolean
}

const INITIAL: Res[] = [
  { id: 1, time: '12:30', name: 'Martina López',   email: 'martina@gmail.com',   party: 2, shift: 'Lunch',  status: 'confirmed',  occasion: 'Anniversary' },
  { id: 2, time: '13:00', name: 'Carlos Herrera',  email: 'c.herrera@email.com', party: 4, shift: 'Lunch',  status: 'confirmed'                            },
  { id: 3, time: '13:30', name: 'Ana Gómez',       email: 'ana.g@work.com',      party: 2, shift: 'Lunch',  status: 'completed',  notes: 'Window table'   },
  { id: 4, time: '20:00', name: 'Rodrigo Paz',     email: 'rpaz@empresa.com',    party: 6, shift: 'Dinner', status: 'confirmed',  occasion: 'Birthday'    },
  { id: 5, time: '20:30', name: 'Sofia Chen',      email: 'sofia@studio.co',     party: 3, shift: 'Dinner', status: 'confirmed'                            },
]

const INCOMING: Res[] = [
  { id: 6, time: '21:00', name: 'Diego Vargas',    email: 'd.vargas@mail.com',   party: 2, shift: 'Dinner', status: 'confirmed',  isNew: true },
  { id: 7, time: '14:00', name: 'Isabella Mora',   email: 'isa.mora@gmail.com',  party: 5, shift: 'Lunch',  status: 'confirmed',  occasion: 'Business', isNew: true },
]

function fmtTime(t: string) { return t.slice(0, 5) }

export function ReservationDemo() {
  const [list, setList]           = useState<Res[]>(INITIAL)
  const [selectedId, setSelectedId] = useState<number>(INITIAL[0].id)
  const [mounted, setMounted]     = useState(false)
  const [flashId, setFlashId]     = useState<number | null>(null)
  const incomingIdx               = useRef(0)
  const cycleRef                  = useRef<ReturnType<typeof setInterval> | null>(null)
  const newResRef                 = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mount: staggered entry
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(t)
  }, [])

  // Auto-cycle selected row every 2.2s
  useEffect(() => {
    cycleRef.current = setInterval(() => {
      setList(prev => {
        setSelectedId(cur => {
          const ids = prev.map(r => r.id)
          const idx = ids.indexOf(cur)
          return ids[(idx + 1) % ids.length]
        })
        return prev
      })
    }, 2200)
    return () => { if (cycleRef.current) clearInterval(cycleRef.current) }
  }, [])

  // New reservation slides in every 9s
  useEffect(() => {
    const schedule = () => {
      newResRef.current = setTimeout(() => {
        if (incomingIdx.current >= INCOMING.length) return
        const newRes = INCOMING[incomingIdx.current++]
        setList(prev => {
          const pos = prev.findIndex(r => r.time >= newRes.time)
          const next = [...prev]
          next.splice(pos === -1 ? next.length : pos, 0, newRes)
          return next
        })
        setFlashId(newRes.id)
        setSelectedId(newRes.id)
        setTimeout(() => setFlashId(null), 1200)
        schedule()
      }, 9000)
    }
    schedule()
    return () => { if (newResRef.current) clearTimeout(newResRef.current) }
  }, [])

  const selected = list.find(r => r.id === selectedId) ?? list[0]
  const statusStyle = STATUS_STYLE[selected.status]

  return (
    <div
      className="w-full max-w-3xl mx-auto rounded-2xl overflow-hidden select-none"
      style={{ backgroundColor: C.card, border: `1px solid ${C.border}`, boxShadow: '0 32px 80px rgba(0,0,0,0.45)' }}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${C.border}`, backgroundColor: 'rgba(255,255,255,0.025)' }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#ff5f57' }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#febc2e' }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#28c840' }} />
        <span className="ml-3 text-xs" style={{ color: 'rgba(242,239,233,0.20)', fontFamily: 'monospace' }}>nativ.business/restaurant/la-mesa</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: 'rgba(242,239,233,0.45)', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
          2026-07-06
        </div>
        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: 'rgba(242,239,233,0.45)', fontSize: '0.8125rem' }}>
          All statuses
        </div>
        <div className="flex-1" />
        <div className="rounded-xl px-4 py-2 text-xs font-semibold" style={{ backgroundColor: C.offwhite, color: C.midnight }}>
          + New reservation
        </div>
      </div>

      {/* Split view */}
      <div className="flex" style={{ minHeight: '320px' }}>

        {/* Left: list */}
        <div className="shrink-0 overflow-hidden" style={{ width: '240px', borderRight: `1px solid ${C.border}` }}>
          {list.map((r, i) => {
            const isSelected = r.id === selectedId
            const isFlash    = r.id === flashId
            return (
              <button
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className="w-full text-left transition-all"
                style={{
                  padding: '12px 16px',
                  borderBottom: `1px solid rgba(255,255,255,0.03)`,
                  borderLeft: isSelected ? `2px solid ${C.gold}` : '2px solid transparent',
                  backgroundColor: isFlash
                    ? 'rgba(111,143,123,0.18)'
                    : isSelected
                    ? 'rgba(255,255,255,0.05)'
                    : 'transparent',
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? 'translateY(0)' : 'translateY(8px)',
                  transition: `opacity 0.35s ease ${i * 60}ms, transform 0.35s ease ${i * 60}ms, background-color 0.4s ease, border-color 0.2s ease`,
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 600, color: C.offwhite, minWidth: '38px' }}>
                    {fmtTime(r.time)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate" style={{ fontSize: '0.8125rem', fontWeight: 500, color: isFlash ? C.sage : C.offwhite }}>
                      {r.isNew && <span style={{ color: C.sage, fontSize: '0.65rem', fontWeight: 700, marginRight: '4px' }}>NEW</span>}
                      {r.name.split(' ')[0]} {r.name.split(' ')[1]?.[0]}.
                    </p>
                    <p style={{ fontSize: '0.6875rem', color: 'rgba(242,239,233,0.30)', marginTop: '1px' }}>{r.party}p</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                    style={{ ...STATUS_STYLE[r.status], backgroundColor: STATUS_STYLE[r.status].bg, border: `1px solid ${STATUS_STYLE[r.status].border}` }}>
                    {r.status === 'confirmed' ? '●' : r.status === 'completed' ? '✓' : '✕'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Right: detail */}
        {selected && (
          <div className="flex-1 p-6" style={{ transition: 'opacity 0.25s ease' }}>
            {/* Time + status */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <p style={{ fontFamily: 'monospace', fontSize: '2.75rem', fontWeight: 700, color: C.offwhite, lineHeight: 1 }}>
                  {fmtTime(selected.time)}
                </p>
                <p style={{ fontSize: '0.8125rem', color: 'rgba(242,239,233,0.35)', marginTop: '6px' }}>
                  {selected.party} {selected.party === 1 ? 'person' : 'people'} · {selected.shift}
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold mt-1"
                style={{ backgroundColor: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`, transition: 'all 0.4s ease' }}>
                {selected.status}
              </span>
            </div>

            {/* Guest */}
            <div className="pb-4 mb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
              <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: C.offwhite }}>{selected.name}</p>
              <p style={{ fontSize: '0.8125rem', color: 'rgba(242,239,233,0.40)', marginTop: '3px' }}>{selected.email}</p>
            </div>

            {/* Details grid */}
            {(selected.occasion || selected.notes) && (
              <div className="pb-4 mb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
                {selected.occasion && (
                  <div className="mb-2">
                    <p style={{ fontSize: '0.625rem', color: 'rgba(242,239,233,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>Occasion</p>
                    <p style={{ fontSize: '0.8125rem', color: 'rgba(242,239,233,0.65)' }}>{selected.occasion}</p>
                  </div>
                )}
                {selected.notes && (
                  <div>
                    <p style={{ fontSize: '0.625rem', color: 'rgba(242,239,233,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>Notes</p>
                    <p style={{ fontSize: '0.8125rem', color: 'rgba(242,239,233,0.50)', fontStyle: 'italic' }}>"{selected.notes}"</p>
                  </div>
                )}
              </div>
            )}

            {/* Status buttons */}
            <div>
              <p style={{ fontSize: '0.625rem', color: 'rgba(242,239,233,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Change status</p>
              <div className="flex gap-2">
                {(['confirmed', 'completed', 'cancelled'] as const).map(s => (
                  <button key={s}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={selected.status === s
                      ? { backgroundColor: C.offwhite, color: C.midnight }
                      : { backgroundColor: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.08)`, color: 'rgba(242,239,233,0.35)' }
                    }>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
