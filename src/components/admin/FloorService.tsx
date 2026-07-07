'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { RestaurantTable, SeatingArea } from '@/lib/types'
import { Users, Clock, Check, UserPlus, X, Minus, Plus } from 'lucide-react'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

const CANVAS_ASPECT = 3 / 4
function hUnits(t: { height: number }) { return t.height / CANVAS_ASPECT }
function fmtTime(t: string) { return t.slice(0, 5) }

const card = { backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }

interface ServiceRes {
  id: string
  time: string
  party_size: number
  status: string
  occasion: string | null
  notes: string | null
  seated_at: string | null
  finished_at: string | null
  source: string
  seating_area_id: string | null
  guest: { name: string; phone: string | null } | null
  table_assignments: { table_id: string }[]
  shift: { duration_minutes: number } | null
}

interface ServiceCombo {
  id: string
  seating_area_id: string
  name: string
  min_covers: number
  max_covers: number
  table_combination_members: { table_id: string }[]
}

interface ServiceState {
  date: string
  tables: RestaurantTable[]
  reservations: ServiceRes[]
  combos: ServiceCombo[]
}

type TableStatus = 'free' | 'reserved' | 'seated' | 'overtime'

// Estilo visual por estado
const TABLE_STYLE: Record<TableStatus, { bg: string; border: string; text: string }> = {
  free:     { bg: 'rgba(255,255,255,0.05)',  border: '1.5px solid rgba(255,255,255,0.15)', text: 'rgba(242,239,233,0.65)' },
  reserved: { bg: 'rgba(201,169,110,0.14)',  border: '1.5px solid rgba(201,169,110,0.55)', text: '#C9A96E' },
  seated:   { bg: 'rgba(111,143,123,0.22)',  border: '1.5px solid rgba(111,143,123,0.70)', text: '#8fb5a0' },
  overtime: { bg: 'rgba(224,85,85,0.16)',    border: '1.5px solid rgba(224,85,85,0.60)',   text: '#e08585' },
}

const LEGEND: { status: TableStatus; label: string }[] = [
  { status: 'free',     label: 'Free' },
  { status: 'reserved', label: 'Reserved' },
  { status: 'seated',   label: 'Seated' },
  { status: 'overtime', label: 'Over time' },
]

function toMinutes(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m }

interface Props {
  areas: SeatingArea[]
  slug: string
  tenantId: string
}

export function FloorService({ areas, slug, tenantId }: Props) {
  const [state, setState]               = useState<ServiceState | null>(null)
  const [activeAreaId, setActiveAreaId] = useState<string | null>(areas[0]?.id ?? null)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [assigningResId, setAssigningResId]   = useState<string | null>(null)
  const [walkInParty, setWalkInParty]   = useState(2)
  const [busy, setBusy]                 = useState(false)
  const [now, setNow]                   = useState(() => Date.now())
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function adminFetch(path: string, options?: RequestInit) {
    const token = await getToken()
    return fetch(`/api/admin?${path}&tenant=${slug}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options?.headers },
    })
  }

  const refetch = useCallback(async () => {
    const res = await adminFetch('resource=service')
    if (res.ok) setState(await res.json())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  // Carga inicial + tick del reloj + refetch al volver a la pestaña
  useEffect(() => { refetch() }, [refetch])
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    const onVisible = () => { if (!document.hidden) refetch() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(tick); document.removeEventListener('visibilitychange', onVisible) }
  }, [refetch])

  // Realtime: cualquier cambio en reservas/asignaciones del tenant → refetch (debounced)
  useEffect(() => {
    const supabase = getBrowserSupabase()
    const debouncedRefetch = () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current)
      refetchTimer.current = setTimeout(refetch, 400)
    }
    const channel = supabase
      .channel(`service-${tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations',      filter: `tenant_id=eq.${tenantId}` }, debouncedRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_assignments', filter: `tenant_id=eq.${tenantId}` }, debouncedRefetch)
      .subscribe()
    // Fallback por si realtime se cae: poll cada 60s
    const poll = setInterval(refetch, 60_000)
    return () => { supabase.removeChannel(channel); clearInterval(poll) }
  }, [tenantId, refetch])

  // ── Estado derivado por mesa ────────────────────────────────
  const nowMinutes = useMemo(() => {
    const d = new Date(now)
    return d.getHours() * 60 + d.getMinutes()
  }, [now])

  const tableInfo = useMemo(() => {
    const map = new Map<string, { status: TableStatus; res: ServiceRes | null; minutesSeated: number }>()
    if (!state) return map
    for (const t of state.tables) {
      const assigned = state.reservations.filter(r =>
        r.table_assignments.some(a => a.table_id === t.id) && !r.finished_at
      )
      const seated = assigned.find(r => r.seated_at)
      if (seated) {
        const mins = Math.floor((now - new Date(seated.seated_at!).getTime()) / 60_000)
        const dur = seated.shift?.duration_minutes ?? 90
        map.set(t.id, { status: mins > dur ? 'overtime' : 'seated', res: seated, minutesSeated: mins })
        continue
      }
      // Próxima reserva no sentada cuya ventana no pasó
      const upcoming = assigned
        .filter(r => toMinutes(r.time) + (r.shift?.duration_minutes ?? 90) > nowMinutes)
        .sort((a, b) => a.time.localeCompare(b.time))[0]
      if (upcoming && toMinutes(upcoming.time) <= nowMinutes + 60) {
        map.set(t.id, { status: 'reserved', res: upcoming, minutesSeated: 0 })
      } else {
        map.set(t.id, { status: 'free', res: upcoming ?? null, minutesSeated: 0 })
      }
    }
    return map
  }, [state, now, nowMinutes])

  // Reservas del día sin mesa asignada
  const unassigned = useMemo(() =>
    (state?.reservations || []).filter(r => r.table_assignments.length === 0 && !r.seated_at),
  [state])

  const areaTables    = (state?.tables || []).filter(t => t.seating_area_id === activeAreaId)
  const selectedTable = (state?.tables || []).find(t => t.id === selectedTableId) ?? null
  const selectedInfo  = selectedTableId ? tableInfo.get(selectedTableId) : null
  const assigningRes  = (state?.reservations || []).find(r => r.id === assigningResId) ?? null

  // Combos que le sirven al party en asignación: capacidad ok y todos los miembros libres
  const comboCandidates = useMemo(() => {
    if (!assigningRes || !state) return []
    return (state.combos || []).filter(c =>
      c.min_covers <= assigningRes.party_size &&
      c.max_covers >= assigningRes.party_size &&
      c.table_combination_members.length >= 2 &&
      c.table_combination_members.every(m => tableInfo.get(m.table_id)?.status === 'free')
    )
  }, [assigningRes, state, tableInfo])

  const comboMemberIds = useMemo(
    () => new Set(comboCandidates.flatMap(c => c.table_combination_members.map(m => m.table_id))),
    [comboCandidates]
  )

  // Mesas candidatas cuando estamos asignando (chequeo aproximado; el server valida)
  const isSingleCandidate = (t: RestaurantTable) => {
    if (!assigningRes) return false
    if (assigningRes.party_size > t.max_covers) return false
    const info = tableInfo.get(t.id)
    return info?.status === 'free'
  }

  const isCandidate = (t: RestaurantTable) => isSingleCandidate(t) || comboMemberIds.has(t.id)

  // ── Acciones ────────────────────────────────────────────────
  const act = async (fn: () => Promise<Response>, okMsg: string) => {
    setBusy(true)
    try {
      const res = await fn()
      if (res.ok) { toast.success(okMsg); await refetch() }
      else {
        const data = await res.json()
        toast.error(data.error || 'Something went wrong')
      }
    } finally { setBusy(false) }
  }

  const seat = (resId: string) =>
    act(() => adminFetch('resource=seat', { method: 'POST', body: JSON.stringify({ reservation_id: resId }) }), 'Party seated')

  const finish = (resId: string) =>
    act(() => adminFetch('resource=finish', { method: 'POST', body: JSON.stringify({ reservation_id: resId }) }), 'Table finished')

  const walkIn = (tableId: string) =>
    act(() => adminFetch('resource=walk-in', { method: 'POST', body: JSON.stringify({ table_id: tableId, party_size: walkInParty }) }), 'Walk-in seated')

  const assign = async (tableIds: string[]) => {
    if (!assigningResId) return
    await act(() => adminFetch('resource=assign-table', { method: 'POST', body: JSON.stringify({ reservation_id: assigningResId, table_ids: tableIds }) }),
      tableIds.length > 1 ? 'Tables combined and assigned' : 'Table assigned')
    setAssigningResId(null)
  }

  const unassign = (resId: string) =>
    act(() => adminFetch(`resource=assign-table&reservation_id=${resId}`, { method: 'DELETE' }), 'Assignment removed')

  const onTableTap = (t: RestaurantTable) => {
    if (assigningResId) {
      if (isSingleCandidate(t)) {
        assign([t.id])
      } else if (comboMemberIds.has(t.id)) {
        const combo = comboCandidates.find(c => c.table_combination_members.some(m => m.table_id === t.id))
        if (combo) assign(combo.table_combination_members.map(m => m.table_id))
      } else {
        toast.error('That table doesn\'t fit this party or is occupied')
      }
      return
    }
    setSelectedTableId(prev => prev === t.id ? null : t.id)
    setWalkInParty(2)
  }

  if (!state) {
    return (
      <div className="p-12 text-center rounded-2xl" style={card}>
        <p className="text-sm text-offwhite/30">Loading floor…</p>
      </div>
    )
  }

  return (
    <div>
      {/* ── Area tabs + legend ── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex gap-1.5 flex-wrap flex-1">
          {areas.map(a => {
            const count = state.tables.filter(t => t.seating_area_id === a.id).length
            const active = a.id === activeAreaId
            return (
              <button key={a.id}
                onClick={() => { setActiveAreaId(a.id); setSelectedTableId(null) }}
                className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
                  active ? 'text-offwhite' : 'text-offwhite/40 hover:text-offwhite/70'
                }`}
                style={active
                  ? { backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }
                  : { backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }
                }>
                {a.name}
                {count > 0 && <span className="ml-1.5 text-xs text-offwhite/30">{count}</span>}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {LEGEND.map(({ status, label }) => (
            <span key={status} className="flex items-center gap-1.5 text-[11px] text-offwhite/40">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TABLE_STYLE[status].border.split('solid ')[1], opacity: 0.85 }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Assigning banner ── */}
      {assigningRes && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-3"
          style={{ backgroundColor: 'rgba(201,169,110,0.10)', border: '1px solid rgba(201,169,110,0.30)' }}>
          <p className="flex-1 text-sm" style={{ color: '#C9A96E' }}>
            Tap a highlighted table to seat <strong>{assigningRes.guest?.name}</strong> ({assigningRes.party_size}p, {fmtTime(assigningRes.time)})
          </p>
          <button onClick={() => setAssigningResId(null)} className="p-1 text-offwhite/40 hover:text-offwhite transition-colors">
            <X size={15} />
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 items-start">

        {/* ── Canvas ── */}
        <div className="flex-1 w-full min-w-0">
          <div
            className="relative w-full rounded-2xl overflow-hidden select-none"
            style={{
              paddingBottom: `${CANVAS_ASPECT * 100}%`,
              backgroundColor: '#101c2b',
              border: '1px solid rgba(255,255,255,0.07)',
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
              backgroundSize: '2.5% 3.333%',
            }}
          >
            {areaTables.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-sm text-offwhite/20 px-6 text-center">No tables in this area yet — draw them in Edit layout</p>
              </div>
            )}

            {areaTables.map(t => {
              const info = tableInfo.get(t.id)
              const status = info?.status ?? 'free'
              const style = TABLE_STYLE[status]
              const candidate = assigningResId ? isCandidate(t) : false
              const dimmed = assigningResId && !candidate
              const isSelected = t.id === selectedTableId && !assigningResId
              return (
                <button
                  key={t.id}
                  onClick={() => onTableTap(t)}
                  className="absolute flex flex-col items-center justify-center transition-all"
                  style={{
                    left: `${t.x}%`,
                    top: `${t.y}%`,
                    width: `${t.width}%`,
                    height: `${hUnits(t)}%`,
                    transform: `translate(-50%, -50%) rotate(${t.rotation}deg)`,
                    borderRadius: t.shape === 'round' ? '50%' : '14%',
                    backgroundColor: style.bg,
                    border: candidate ? '2px dashed #C9A96E' : isSelected ? `2px solid ${style.border.split('solid ')[1]}` : style.border,
                    opacity: dimmed ? 0.25 : 1,
                    zIndex: isSelected || candidate ? 2 : 1,
                    cursor: 'pointer',
                  }}
                >
                  <span className="font-semibold pointer-events-none"
                    style={{ fontSize: 'clamp(10px, 1.4vw, 14px)', color: style.text, transform: `rotate(${-t.rotation}deg)` }}>
                    {t.name}
                  </span>
                  <span className="pointer-events-none"
                    style={{ fontSize: 'clamp(8px, 1vw, 11px)', color: 'rgba(242,239,233,0.40)', transform: `rotate(${-t.rotation}deg)` }}>
                    {status === 'seated' || status === 'overtime'
                      ? `${info!.res!.party_size}p · ${info!.minutesSeated}m`
                      : status === 'reserved'
                      ? `${fmtTime(info!.res!.time)}`
                      : `${t.min_covers}–${t.max_covers}`}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Side panel ── */}
        <div className="w-full lg:w-80 shrink-0 space-y-3">

          {/* Selected table actions — bottom sheet en mobile, tarjeta en desktop */}
          {selectedTable && selectedInfo && (
            <div
              className="rounded-2xl p-5 fixed bottom-[76px] md:bottom-4 left-3 right-3 z-30 shadow-2xl lg:static lg:z-auto lg:shadow-none lg:left-auto lg:right-auto lg:bottom-auto"
              style={card}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-satoshi font-bold text-[15px] text-offwhite">
                  {selectedTable.name}
                  <span className="ml-2 text-xs font-normal" style={{ color: TABLE_STYLE[selectedInfo.status].text }}>
                    {selectedInfo.status === 'overtime' ? 'over time' : selectedInfo.status}
                  </span>
                </h3>
                <button onClick={() => setSelectedTableId(null)} className="p-1 text-offwhite/30 hover:text-offwhite transition-colors">
                  <X size={15} />
                </button>
              </div>

              {(selectedInfo.status === 'seated' || selectedInfo.status === 'overtime') && selectedInfo.res && (
                <>
                  <p className="text-sm font-semibold text-offwhite">{selectedInfo.res.guest?.name}</p>
                  <p className="text-xs text-offwhite/40 mt-0.5 flex items-center gap-2">
                    <Users size={11} /> {selectedInfo.res.party_size} people
                    <Clock size={11} className="ml-1" /> {selectedInfo.minutesSeated} min
                    {selectedInfo.res.source === 'walk_in' && <span className="text-offwhite/25">· walk-in</span>}
                  </p>
                  {selectedInfo.res.notes && <p className="text-xs text-offwhite/30 italic mt-1.5">"{selectedInfo.res.notes}"</p>}
                  <button onClick={() => finish(selectedInfo.res!.id)} disabled={busy}
                    className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-offwhite text-midnight hover:bg-offwhite/90 transition-colors disabled:opacity-40">
                    <Check size={14} /> Finish table
                  </button>
                </>
              )}

              {selectedInfo.status === 'reserved' && selectedInfo.res && (
                <>
                  <p className="text-sm font-semibold text-offwhite">{selectedInfo.res.guest?.name}</p>
                  <p className="text-xs text-offwhite/40 mt-0.5">
                    {fmtTime(selectedInfo.res.time)} · {selectedInfo.res.party_size} people
                    {selectedInfo.res.occasion && <span className="text-offwhite/30"> · {selectedInfo.res.occasion}</span>}
                  </p>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => seat(selectedInfo.res!.id)} disabled={busy}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-offwhite text-midnight hover:bg-offwhite/90 transition-colors disabled:opacity-40">
                      Seat party
                    </button>
                    <button onClick={() => unassign(selectedInfo.res!.id)} disabled={busy}
                      className="px-4 py-2.5 rounded-xl text-sm text-offwhite/40 hover:text-offwhite transition-colors disabled:opacity-40"
                      style={{ border: '1px solid rgba(255,255,255,0.10)' }}>
                      Unassign
                    </button>
                  </div>
                </>
              )}

              {selectedInfo.status === 'free' && (
                <>
                  {selectedInfo.res && (
                    <p className="text-xs text-offwhite/30 mb-3">
                      Next: {selectedInfo.res.guest?.name} at {fmtTime(selectedInfo.res.time)}
                    </p>
                  )}
                  <p className="text-xs text-offwhite/35 uppercase tracking-widest font-semibold mb-2">Seat walk-in</p>
                  <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => setWalkInParty(p => Math.max(1, p - 1))}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-offwhite/50 hover:text-offwhite transition-colors"
                      style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <Minus size={14} />
                    </button>
                    <span className="font-satoshi font-bold text-2xl text-offwhite w-10 text-center">{walkInParty}</span>
                    <button onClick={() => setWalkInParty(p => Math.min(selectedTable.max_covers, p + 1))}
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-offwhite/50 hover:text-offwhite transition-colors"
                      style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <Plus size={14} />
                    </button>
                    <span className="text-xs text-offwhite/25">max {selectedTable.max_covers}</span>
                  </div>
                  <button onClick={() => walkIn(selectedTable.id)} disabled={busy}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-offwhite text-midnight hover:bg-offwhite/90 transition-colors disabled:opacity-40">
                    <UserPlus size={14} /> Seat walk-in
                  </button>
                </>
              )}
            </div>
          )}

          {/* Unassigned reservations */}
          <div className="rounded-2xl overflow-hidden" style={card}>
            <div className="px-4 py-3" style={{ borderBottom: unassigned.length > 0 ? '1px solid rgba(255,255,255,0.06)' : undefined }}>
              <h3 className="text-xs text-offwhite/35 uppercase tracking-widest font-semibold">
                Needs a table {unassigned.length > 0 && <span className="text-gold ml-1">{unassigned.length}</span>}
              </h3>
            </div>
            {unassigned.length === 0 ? (
              <p className="px-4 py-4 text-xs text-offwhite/25">All of today's reservations have tables.</p>
            ) : (
              unassigned.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3"
                  style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.04)' } : undefined}>
                  <span className="font-mono text-sm font-semibold text-offwhite w-[42px] shrink-0">{fmtTime(r.time)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-offwhite truncate">{r.guest?.name}</p>
                    <p className="text-[11px] text-offwhite/35">{r.party_size} people{r.occasion ? ` · ${r.occasion}` : ''}</p>
                  </div>
                  <button
                    onClick={() => { setAssigningResId(prev => prev === r.id ? null : r.id); setSelectedTableId(null) }}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                      assigningResId === r.id ? 'text-midnight' : 'text-offwhite/50 hover:text-offwhite'
                    }`}
                    style={assigningResId === r.id
                      ? { backgroundColor: '#C9A96E' }
                      : { border: '1px solid rgba(255,255,255,0.10)' }
                    }>
                    {assigningResId === r.id ? 'Cancel' : 'Assign'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
