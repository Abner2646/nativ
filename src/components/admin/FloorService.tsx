'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { RestaurantTable, SeatingArea } from '@/lib/types'
import {
  Users, Clock, Check, UserPlus, X, Minus, Plus,
  LayoutGrid, GanttChartSquare, ZoomIn, ZoomOut, ListPlus,
} from 'lucide-react'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

const CANVAS_ASPECT = 3 / 4
function hUnits(t: { height: number }) { return t.height / CANVAS_ASPECT }
function fmtTime(t: string) { return t.slice(0, 5) }
function toMinutes(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function fmtMin(mins: number) {
  const h = Math.floor(mins / 60) % 24, m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

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
  duration_minutes: number | null
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

interface WaitlistEntry {
  id: string
  name: string
  phone: string | null
  party_size: number
  quoted_minutes: number | null
  created_at: string
}

interface ServiceState {
  date: string
  now: string // HH:MM en el timezone del restaurante
  tables: RestaurantTable[]
  reservations: ServiceRes[]
  combos: ServiceCombo[]
  waitlist: WaitlistEntry[]
}

type TableStatus = 'free' | 'reserved' | 'seated' | 'overtime'

const TABLE_STYLE: Record<TableStatus, { bg: string; border: string; text: string; dot: string }> = {
  free:     { bg: 'rgba(255,255,255,0.05)',  border: '1.5px solid rgba(255,255,255,0.15)', text: 'rgba(242,239,233,0.65)', dot: 'rgba(255,255,255,0.35)' },
  reserved: { bg: 'rgba(201,169,110,0.14)',  border: '1.5px solid rgba(201,169,110,0.55)', text: '#C9A96E', dot: '#C9A96E' },
  seated:   { bg: 'rgba(111,143,123,0.22)',  border: '1.5px solid rgba(111,143,123,0.70)', text: '#8fb5a0', dot: '#6F8F7B' },
  overtime: { bg: 'rgba(224,85,85,0.16)',    border: '1.5px solid rgba(224,85,85,0.60)',   text: '#e08585', dot: '#e05555' },
}

const LEGEND: { status: TableStatus; label: string }[] = [
  { status: 'free',     label: 'Free' },
  { status: 'reserved', label: 'Reserved' },
  { status: 'seated',   label: 'Seated' },
  { status: 'overtime', label: 'Over time' },
]

function resDuration(r: ServiceRes) { return r.duration_minutes ?? r.shift?.duration_minutes ?? 90 }

interface Props {
  areas: SeatingArea[]
  slug: string
  tenantId: string
}

export function FloorService({ areas, slug, tenantId }: Props) {
  const [state, setState]               = useState<ServiceState | null>(null)
  const [fetchedAt, setFetchedAt]       = useState(0)
  const [view, setView]                 = useState<'floor' | 'timeline'>('floor')
  const [zoom, setZoom]                 = useState(1)
  const [activeAreaId, setActiveAreaId] = useState<string | null>(areas[0]?.id ?? null)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [timelineSelId, setTimelineSelId]     = useState<string | null>(null)
  const [assigningResId, setAssigningResId]   = useState<string | null>(null)
  const [seatingEntry, setSeatingEntry]       = useState<WaitlistEntry | null>(null)
  const [pendingMove, setPendingMove]         = useState<{ tableIds: string[]; toArea: string } | null>(null)
  const [walkInParty, setWalkInParty]   = useState(2)
  const [busy, setBusy]                 = useState(false)
  const [now, setNow]                   = useState(() => Date.now())
  const [wlForm, setWlForm]             = useState({ name: '', party: 2, quote: '' })
  const [wlOpen, setWlOpen]             = useState(false)
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
    if (res.ok) { setState(await res.json()); setFetchedAt(Date.now()) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  useEffect(() => { refetch() }, [refetch])
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    const onVisible = () => { if (!document.hidden) refetch() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(tick); document.removeEventListener('visibilitychange', onVisible) }
  }, [refetch])

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waitlist_entries',  filter: `tenant_id=eq.${tenantId}` }, debouncedRefetch)
      .subscribe()
    const poll = setInterval(refetch, 60_000)
    return () => { supabase.removeChannel(channel); clearInterval(poll) }
  }, [tenantId, refetch])

  // Hora "ahora" en minutos del restaurante: la del server + lo transcurrido
  // desde el fetch. Nunca la del reloj del dispositivo (puede estar en otro tz).
  const nowMinutes = useMemo(() => {
    if (!state) return 0
    return toMinutes(state.now) + Math.floor((now - fetchedAt) / 60_000)
  }, [state, now, fetchedAt])

  const confirmed = useMemo(() => (state?.reservations || []).filter(r => r.status === 'confirmed'), [state])

  const tableInfo = useMemo(() => {
    const map = new Map<string, { status: TableStatus; res: ServiceRes | null; minutesSeated: number }>()
    if (!state) return map
    for (const t of state.tables) {
      const assigned = confirmed.filter(r =>
        r.table_assignments.some(a => a.table_id === t.id) && !r.finished_at
      )
      const seated = assigned.find(r => r.seated_at)
      if (seated) {
        const mins = Math.floor((now - new Date(seated.seated_at!).getTime()) / 60_000)
        map.set(t.id, { status: mins > resDuration(seated) ? 'overtime' : 'seated', res: seated, minutesSeated: mins })
        continue
      }
      const upcoming = assigned
        .filter(r => toMinutes(r.time) + resDuration(r) > nowMinutes)
        .sort((a, b) => a.time.localeCompare(b.time))[0]
      if (upcoming && toMinutes(upcoming.time) <= nowMinutes + 60) {
        map.set(t.id, { status: 'reserved', res: upcoming, minutesSeated: 0 })
      } else {
        map.set(t.id, { status: 'free', res: upcoming ?? null, minutesSeated: 0 })
      }
    }
    return map
  }, [state, confirmed, now, nowMinutes])

  const unassigned = useMemo(() =>
    confirmed.filter(r => r.table_assignments.length === 0 && !r.seated_at),
  [confirmed])

  const areaTables    = (state?.tables || []).filter(t => t.seating_area_id === activeAreaId)
  const selectedTable = (state?.tables || []).find(t => t.id === selectedTableId) ?? null
  const selectedInfo  = selectedTableId ? tableInfo.get(selectedTableId) : null
  const assigningRes  = confirmed.find(r => r.id === assigningResId) ?? null

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

  const activeParty = assigningRes?.party_size ?? seatingEntry?.party_size ?? null

  const isSingleCandidate = (t: RestaurantTable) => {
    if (activeParty == null) return false
    if (activeParty > t.max_covers) return false
    return tableInfo.get(t.id)?.status === 'free'
  }
  const isCandidate = (t: RestaurantTable) =>
    isSingleCandidate(t) || (!!assigningRes && comboMemberIds.has(t.id))

  // ── Acciones ────────────────────────────────────────────────
  const act = async (fn: () => Promise<Response>, okMsg: string, undo?: () => void) => {
    setBusy(true)
    try {
      const res = await fn()
      if (res.ok) {
        toast.success(okMsg, undo ? { action: { label: 'Undo', onClick: undo } } : undefined)
        await refetch()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Something went wrong')
      }
    } finally { setBusy(false) }
  }

  const unseat = (resId: string) =>
    act(() => adminFetch('resource=unseat', { method: 'POST', body: JSON.stringify({ reservation_id: resId }) }), 'Seating undone')

  const unfinish = (resId: string) =>
    act(() => adminFetch('resource=unfinish', { method: 'POST', body: JSON.stringify({ reservation_id: resId }) }), 'Finish undone — table is seated again')

  const seat = (resId: string) =>
    act(() => adminFetch('resource=seat', { method: 'POST', body: JSON.stringify({ reservation_id: resId }) }), 'Party seated', () => unseat(resId))

  const finish = (resId: string) =>
    act(() => adminFetch('resource=finish', { method: 'POST', body: JSON.stringify({ reservation_id: resId }) }), 'Table finished', () => unfinish(resId))

  const walkIn = (tableId: string) =>
    act(() => adminFetch('resource=walk-in', { method: 'POST', body: JSON.stringify({ table_id: tableId, party_size: walkInParty }) }), 'Walk-in seated')

  const doAssign = async (tableIds: string[]) => {
    if (!assigningResId) return
    await act(() => adminFetch('resource=assign-table', { method: 'POST', body: JSON.stringify({ reservation_id: assigningResId, table_ids: tableIds }) }),
      tableIds.length > 1 ? 'Tables combined and assigned' : 'Table assigned')
    setAssigningResId(null)
  }

  const requestAssign = (tableIds: string[], targetAreaId: string) => {
    // Asignar mesa de otra área mueve la reserva de área — confirmar primero
    if (assigningRes?.seating_area_id && assigningRes.seating_area_id !== targetAreaId) {
      const toArea = areas.find(a => a.id === targetAreaId)?.name || 'another area'
      setPendingMove({ tableIds, toArea })
      return
    }
    doAssign(tableIds)
  }

  const unassign = (resId: string) =>
    act(() => adminFetch(`resource=assign-table&reservation_id=${resId}`, { method: 'DELETE' }), 'Assignment removed')

  const seatWaitlistEntry = async (tableId: string) => {
    if (!seatingEntry) return
    await act(() => adminFetch('resource=walk-in', {
      method: 'POST',
      body: JSON.stringify({
        table_id: tableId, party_size: seatingEntry.party_size,
        guest_name: seatingEntry.name, waitlist_entry_id: seatingEntry.id,
      }),
    }), `${seatingEntry.name} seated`)
    setSeatingEntry(null)
  }

  const addWaitlist = async () => {
    if (!wlForm.name.trim()) return
    const res = await adminFetch('resource=waitlist', {
      method: 'POST',
      body: JSON.stringify({ name: wlForm.name.trim(), party_size: wlForm.party, quoted_minutes: wlForm.quote ? parseInt(wlForm.quote) : null }),
    })
    if (res.ok) { setWlForm({ name: '', party: 2, quote: '' }); setWlOpen(false); refetch() }
    else toast.error('Failed to add to waitlist')
  }

  const removeWaitlist = (id: string) =>
    act(() => adminFetch(`resource=waitlist&id=${id}`, { method: 'DELETE' }), 'Removed from waitlist')

  const onTableTap = (t: RestaurantTable) => {
    if (seatingEntry) {
      if (isSingleCandidate(t)) seatWaitlistEntry(t.id)
      else toast.error('That table doesn\'t fit this party or is occupied')
      return
    }
    if (assigningResId) {
      if (isSingleCandidate(t)) {
        requestAssign([t.id], t.seating_area_id)
      } else if (comboMemberIds.has(t.id)) {
        const combo = comboCandidates.find(c => c.table_combination_members.some(m => m.table_id === t.id))
        if (combo) requestAssign(combo.table_combination_members.map(m => m.table_id), combo.seating_area_id)
      } else {
        toast.error('That table doesn\'t fit this party or is occupied')
      }
      return
    }
    setSelectedTableId(prev => prev === t.id ? null : t.id)
    setWalkInParty(2)
  }

  // ── Timeline ────────────────────────────────────────────────
  const timeline = useMemo(() => {
    if (!state) return null
    const all = state.reservations
    const starts = all.map(r => toMinutes(r.time))
    const ends   = all.map(r => toMinutes(r.time) + resDuration(r))
    let rangeStart = starts.length ? Math.min(...starts) - 30 : 12 * 60
    let rangeEnd   = ends.length   ? Math.max(...ends) + 30   : 23 * 60
    rangeStart = Math.floor(rangeStart / 60) * 60
    rangeEnd   = Math.ceil(rangeEnd / 60) * 60
    if (rangeEnd - rangeStart < 6 * 60) rangeEnd = rangeStart + 6 * 60
    const hours: number[] = []
    for (let h = rangeStart; h <= rangeEnd; h += 60) hours.push(h)
    return { rangeStart, rangeEnd, len: rangeEnd - rangeStart, hours }
  }, [state])

  const timelineSel = (state?.reservations || []).find(r => r.id === timelineSelId) ?? null

  const blockColor = (r: ServiceRes) => {
    if (r.status === 'completed') return { bg: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', text: 'rgba(242,239,233,0.35)' }
    if (r.seated_at) {
      const mins = Math.floor((now - new Date(r.seated_at).getTime()) / 60_000)
      return mins > resDuration(r)
        ? { bg: 'rgba(224,85,85,0.20)',   border: '1px solid rgba(224,85,85,0.50)',   text: '#e08585' }
        : { bg: 'rgba(111,143,123,0.25)', border: '1px solid rgba(111,143,123,0.60)', text: '#8fb5a0' }
    }
    return { bg: 'rgba(201,169,110,0.18)', border: '1px solid rgba(201,169,110,0.45)', text: '#C9A96E' }
  }

  if (!state || !timeline) {
    return (
      <div className="p-12 text-center rounded-2xl" style={card}>
        <p className="text-sm text-offwhite/30">Loading floor…</p>
      </div>
    )
  }

  const assignBanner = assigningRes
    ? { text: <>Tap a highlighted table to seat <strong>{assigningRes.guest?.name}</strong> ({assigningRes.party_size}p, {fmtTime(assigningRes.time)})</>, cancel: () => setAssigningResId(null) }
    : seatingEntry
    ? { text: <>Tap a free table to seat <strong>{seatingEntry.name}</strong> ({seatingEntry.party_size}p from waitlist)</>, cancel: () => setSeatingEntry(null) }
    : null

  return (
    <div>
      <ConfirmModal
        open={!!pendingMove}
        title="Move reservation to another area?"
        message={`This table is in ${pendingMove?.toArea}. Assigning it will move the reservation to that area.`}
        confirmLabel="Move & assign"
        loading={busy}
        onConfirm={() => { if (pendingMove) { doAssign(pendingMove.tableIds); setPendingMove(null) } }}
        onCancel={() => setPendingMove(null)}
      />

      {/* ── Toolbar: areas + view toggle + legend ── */}
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

        {/* View toggle */}
        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          {([
            { value: 'floor',    icon: LayoutGrid,       label: 'Floor' },
            { value: 'timeline', icon: GanttChartSquare, label: 'Timeline' },
          ] as const).map(({ value, icon: Icon, label }) => (
            <button key={value} onClick={() => setView(value)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                view === value ? 'text-midnight' : 'text-offwhite/40 hover:text-offwhite/70'
              }`}
              style={view === value ? { backgroundColor: '#F2EFE9' } : { backgroundColor: 'rgba(255,255,255,0.03)' }}>
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {view === 'floor' && (
          <div className="hidden sm:flex items-center gap-3 flex-wrap">
            {LEGEND.map(({ status, label }) => (
              <span key={status} className="flex items-center gap-1.5 text-[11px] text-offwhite/40">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TABLE_STYLE[status].dot }} />
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Assign / waitlist-seat banner ── */}
      {assignBanner && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-3"
          style={{ backgroundColor: 'rgba(201,169,110,0.10)', border: '1px solid rgba(201,169,110,0.30)' }}>
          <p className="flex-1 text-sm" style={{ color: '#C9A96E' }}>{assignBanner.text}</p>
          <button onClick={assignBanner.cancel} className="p-1 text-offwhite/40 hover:text-offwhite transition-colors">
            <X size={15} />
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <div className="flex-1 w-full min-w-0">

          {view === 'floor' ? (
            <div className="relative">
              {/* Zoom controls */}
              <div className="absolute top-2 right-2 z-10 flex gap-1">
                <button onClick={() => setZoom(z => Math.min(2, +(z + 0.25).toFixed(2)))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-offwhite/50 hover:text-offwhite transition-colors"
                  style={{ backgroundColor: 'rgba(13,27,42,0.85)', border: '1px solid rgba(255,255,255,0.10)' }}>
                  <ZoomIn size={14} />
                </button>
                <button onClick={() => setZoom(z => Math.max(1, +(z - 0.25).toFixed(2)))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-offwhite/50 hover:text-offwhite transition-colors"
                  style={{ backgroundColor: 'rgba(13,27,42,0.85)', border: '1px solid rgba(255,255,255,0.10)' }}>
                  <ZoomOut size={14} />
                </button>
                {zoom > 1 && (
                  <button onClick={() => setZoom(1)}
                    className="h-8 px-2 rounded-lg flex items-center justify-center text-[11px] text-offwhite/50 hover:text-offwhite transition-colors"
                    style={{ backgroundColor: 'rgba(13,27,42,0.85)', border: '1px solid rgba(255,255,255,0.10)' }}>
                    {Math.round(zoom * 100)}%
                  </button>
                )}
              </div>

              <div className="overflow-auto rounded-2xl" style={{ maxHeight: '75vh' }}>
                <div style={{ width: `${zoom * 100}%` }}>
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
                      const candidate = (assigningResId || seatingEntry) ? isCandidate(t) : false
                      const dimmed = (assigningResId || seatingEntry) && !candidate
                      const isSelected = t.id === selectedTableId && !assigningResId && !seatingEntry
                      const hasLater = status === 'free' && !!info?.res
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
                          {/* Punto dorado: mesa libre pero con reserva más tarde hoy */}
                          {hasLater && (
                            <span className="absolute w-2 h-2 rounded-full pointer-events-none"
                              style={{ top: '8%', right: '10%', backgroundColor: '#C9A96E', transform: `rotate(${-t.rotation}deg)` }} />
                          )}
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
              </div>
            </div>
          ) : (
            /* ── Timeline view ── */
            <div className="rounded-2xl p-4 overflow-x-auto" style={card}>
              {/* Selected block action bar */}
              {timelineSel && (
                <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 rounded-xl mb-3"
                  style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-offwhite truncate">{timelineSel.guest?.name}</p>
                    <p className="text-[11px] text-offwhite/40">
                      {fmtTime(timelineSel.time)} · {timelineSel.party_size}p · {timelineSel.status}
                      {timelineSel.seated_at && !timelineSel.finished_at ? ' · seated' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {timelineSel.status === 'confirmed' && !timelineSel.seated_at && (
                      <button onClick={() => { seat(timelineSel.id); setTimelineSelId(null) }} disabled={busy}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-offwhite text-midnight disabled:opacity-40">Seat</button>
                    )}
                    {timelineSel.status === 'confirmed' && timelineSel.seated_at && (
                      <>
                        <button onClick={() => { finish(timelineSel.id); setTimelineSelId(null) }} disabled={busy}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-offwhite text-midnight disabled:opacity-40">Finish</button>
                        <button onClick={() => { unseat(timelineSel.id); setTimelineSelId(null) }} disabled={busy}
                          className="text-xs px-3 py-1.5 rounded-lg text-offwhite/50 disabled:opacity-40" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>Unseat</button>
                      </>
                    )}
                    {timelineSel.status === 'completed' && (
                      <button onClick={() => { unfinish(timelineSel.id); setTimelineSelId(null) }} disabled={busy}
                        className="text-xs px-3 py-1.5 rounded-lg text-offwhite/50 disabled:opacity-40" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>Undo finish</button>
                    )}
                    <button onClick={() => setTimelineSelId(null)} className="p-1.5 text-offwhite/30 hover:text-offwhite">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              )}

              <div style={{ minWidth: `${Math.max(600, timeline.len * 2)}px` }}>
                {/* Hour header */}
                <div className="relative h-6 mb-1" style={{ marginLeft: '72px' }}>
                  {timeline.hours.map(h => (
                    <span key={h} className="absolute text-[10px] text-offwhite/30 font-mono"
                      style={{ left: `${((h - timeline.rangeStart) / timeline.len) * 100}%`, transform: 'translateX(-50%)' }}>
                      {fmtMin(h)}
                    </span>
                  ))}
                </div>

                {/* Rows */}
                {[...areaTables.map(t => ({ key: t.id, label: t.name, resList: state.reservations.filter(r => r.table_assignments.some(a => a.table_id === t.id)) })),
                  ...(unassigned.length > 0 ? [{ key: '__none__', label: '—', resList: unassigned }] : []),
                ].map(row => (
                  <div key={row.key} className="flex items-center" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="w-[72px] shrink-0 text-xs font-mono text-offwhite/45 py-3 pr-2 truncate">
                      {row.key === '__none__' ? 'No table' : row.label}
                    </span>
                    <div className="relative flex-1 h-10">
                      {/* Hour gridlines */}
                      {timeline.hours.map(h => (
                        <span key={h} className="absolute top-0 bottom-0 pointer-events-none"
                          style={{ left: `${((h - timeline.rangeStart) / timeline.len) * 100}%`, borderLeft: '1px solid rgba(255,255,255,0.04)' }} />
                      ))}
                      {/* Now line */}
                      {nowMinutes >= timeline.rangeStart && nowMinutes <= timeline.rangeEnd && (
                        <span className="absolute top-0 bottom-0 pointer-events-none z-10"
                          style={{ left: `${((nowMinutes - timeline.rangeStart) / timeline.len) * 100}%`, borderLeft: '1.5px solid rgba(224,85,85,0.55)' }} />
                      )}
                      {/* Blocks */}
                      {row.resList.map(r => {
                        const start = toMinutes(r.time)
                        const c = blockColor(r)
                        return (
                          <button
                            key={r.id}
                            onClick={() => setTimelineSelId(prev => prev === r.id ? null : r.id)}
                            className="absolute top-1.5 bottom-1.5 rounded-lg px-1.5 overflow-hidden text-left transition-opacity hover:opacity-80"
                            style={{
                              left: `${((start - timeline.rangeStart) / timeline.len) * 100}%`,
                              width: `${(resDuration(r) / timeline.len) * 100}%`,
                              backgroundColor: c.bg,
                              border: timelineSelId === r.id ? '1.5px solid #F2EFE9' : c.border,
                              minWidth: '32px',
                            }}
                          >
                            <span className="text-[10px] font-medium block truncate leading-tight mt-0.5" style={{ color: c.text }}>
                              {r.guest?.name?.split(' ')[0] || '—'}
                            </span>
                            <span className="text-[9px] block truncate" style={{ color: 'rgba(242,239,233,0.30)' }}>
                              {r.party_size}p
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {areaTables.length === 0 && unassigned.length === 0 && (
                  <p className="text-sm text-offwhite/25 py-8 text-center">Nothing scheduled today in this area.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Side panel ── */}
        <div className="w-full lg:w-80 shrink-0 space-y-3">

          {/* Selected table actions — bottom sheet en mobile */}
          {view === 'floor' && selectedTable && selectedInfo && (
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
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => finish(selectedInfo.res!.id)} disabled={busy}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-offwhite text-midnight hover:bg-offwhite/90 transition-colors disabled:opacity-40">
                      <Check size={14} /> Finish table
                    </button>
                    <button onClick={() => unseat(selectedInfo.res!.id)} disabled={busy}
                      className="px-4 py-2.5 rounded-xl text-sm text-offwhite/40 hover:text-offwhite transition-colors disabled:opacity-40"
                      style={{ border: '1px solid rgba(255,255,255,0.10)' }}>
                      Unseat
                    </button>
                  </div>
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
                    <p className="text-xs mb-3" style={{ color: '#C9A96E' }}>
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

          {/* Waitlist */}
          <div className="rounded-2xl overflow-hidden" style={card}>
            <div className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: (state.waitlist.length > 0 || wlOpen) ? '1px solid rgba(255,255,255,0.06)' : undefined }}>
              <h3 className="text-xs text-offwhite/35 uppercase tracking-widest font-semibold">
                Waitlist {state.waitlist.length > 0 && <span className="text-gold ml-1">{state.waitlist.length}</span>}
              </h3>
              <button onClick={() => setWlOpen(o => !o)}
                className="flex items-center gap-1 text-xs text-offwhite/50 hover:text-offwhite px-2 py-1 rounded-lg transition-colors"
                style={{ border: '1px solid rgba(255,255,255,0.10)' }}>
                <ListPlus size={12} /> Add
              </button>
            </div>

            {wlOpen && (
              <div className="px-4 py-3 space-y-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <input value={wlForm.name} onChange={e => setWlForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Guest name" autoFocus
                  className="w-full bg-black/25 border border-white/[0.08] text-offwhite rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/25 placeholder:text-offwhite/20" />
                <div className="flex gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <button onClick={() => setWlForm(f => ({ ...f, party: Math.max(1, f.party - 1) }))}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-offwhite/50"
                      style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <Minus size={12} />
                    </button>
                    <span className="font-bold text-offwhite w-6 text-center text-sm">{wlForm.party}</span>
                    <button onClick={() => setWlForm(f => ({ ...f, party: Math.min(30, f.party + 1) }))}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-offwhite/50"
                      style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <Plus size={12} />
                    </button>
                  </div>
                  <input value={wlForm.quote} onChange={e => setWlForm(f => ({ ...f, quote: e.target.value }))}
                    placeholder="Quote (min)" type="number" min={0}
                    className="w-24 bg-black/25 border border-white/[0.08] text-offwhite rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-white/25 placeholder:text-offwhite/20" />
                </div>
                <button onClick={addWaitlist} disabled={!wlForm.name.trim()}
                  className="w-full py-2 rounded-xl text-xs font-semibold bg-offwhite text-midnight hover:bg-offwhite/90 transition-colors disabled:opacity-40">
                  Add to waitlist
                </button>
              </div>
            )}

            {state.waitlist.length === 0 && !wlOpen ? (
              <p className="px-4 py-3.5 text-xs text-offwhite/25">No one waiting.</p>
            ) : (
              state.waitlist.map((w, i) => {
                const waited = Math.floor((now - new Date(w.created_at).getTime()) / 60_000)
                const overQuote = w.quoted_minutes != null && waited > w.quoted_minutes
                return (
                  <div key={w.id} className="flex items-center gap-3 px-4 py-3"
                    style={i > 0 || wlOpen ? { borderTop: '1px solid rgba(255,255,255,0.04)' } : undefined}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-offwhite truncate">{w.name}</p>
                      <p className="text-[11px]" style={{ color: overQuote ? '#e08585' : 'rgba(242,239,233,0.35)' }}>
                        {w.party_size}p · waiting {waited}m{w.quoted_minutes != null ? ` / ${w.quoted_minutes}m quoted` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => { setSeatingEntry(prev => prev?.id === w.id ? null : w); setAssigningResId(null); setSelectedTableId(null); setView('floor') }}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                        seatingEntry?.id === w.id ? 'text-midnight' : 'text-offwhite/50 hover:text-offwhite'
                      }`}
                      style={seatingEntry?.id === w.id ? { backgroundColor: '#C9A96E' } : { border: '1px solid rgba(255,255,255,0.10)' }}>
                      {seatingEntry?.id === w.id ? 'Cancel' : 'Seat'}
                    </button>
                    <button onClick={() => removeWaitlist(w.id)}
                      className="p-1 text-offwhite/20 hover:text-red-400 transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {/* Unassigned reservations */}
          <div className="rounded-2xl overflow-hidden" style={card}>
            <div className="px-4 py-3" style={{ borderBottom: unassigned.length > 0 ? '1px solid rgba(255,255,255,0.06)' : undefined }}>
              <h3 className="text-xs text-offwhite/35 uppercase tracking-widest font-semibold">
                Needs a table {unassigned.length > 0 && <span className="text-gold ml-1">{unassigned.length}</span>}
              </h3>
            </div>
            {unassigned.length === 0 ? (
              <p className="px-4 py-3.5 text-xs text-offwhite/25">All of today's reservations have tables.</p>
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
                    onClick={() => { setAssigningResId(prev => prev === r.id ? null : r.id); setSeatingEntry(null); setSelectedTableId(null); setView('floor') }}
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
