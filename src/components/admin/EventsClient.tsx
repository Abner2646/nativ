'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { SpecialEvent, BlockedDate } from '@/lib/types'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

interface Props { initialEvents: SpecialEvent[]; initialBlocked: BlockedDate[]; slug: string }

const EMPTY_EVENT = { name: '', date: '', deposit_amount: 0, refund_cutoff_hours: 24 }

const inputCls = 'bg-black/25 border border-white/[0.08] text-offwhite rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-white/25 placeholder:text-offwhite/20'
const labelCls = 'text-xs text-offwhite/35 uppercase tracking-widest mb-1.5 block font-semibold'

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between pb-3 mb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <h2 className="text-xs text-offwhite/35 uppercase tracking-widest font-semibold">{title}</h2>
      {action}
    </div>
  )
}

export function EventsClient({ initialEvents, initialBlocked, slug }: Props) {
  const [events, setEvents] = useState<SpecialEvent[]>(initialEvents)
  const [blocked, setBlocked] = useState<BlockedDate[]>(initialBlocked)
  const [showEventModal, setShowEventModal] = useState(false)
  const [eventForm, setEventForm] = useState(EMPTY_EVENT)
  const [savingEvent, setSavingEvent] = useState(false)
  const [eventError, setEventError] = useState('')
  const [blockDate, setBlockDate] = useState('')
  const [blockReason, setBlockReason] = useState('')
  const [blockingDate, setBlockingDate] = useState(false)
  const [blockError, setBlockError] = useState('')
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState<{ id: string; name: string } | null>(null)
  const [deletingEvent, setDeletingEvent] = useState(false)

  async function adminFetch(path: string, options?: RequestInit) {
    const token = await getToken()
    return fetch(`/api/admin?${path}&tenant=${slug}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options?.headers },
    })
  }

  const createEvent = async () => {
    if (!eventForm.name || !eventForm.date || !eventForm.deposit_amount) { setEventError('Name, date and deposit are required'); return }
    setSavingEvent(true); setEventError('')
    const res = await adminFetch('resource=events', { method: 'POST', body: JSON.stringify(eventForm) })
    setSavingEvent(false)
    if (res.ok) {
      const data = await res.json()
      setEvents(prev => [...prev, data.event].sort((a, b) => a.date.localeCompare(b.date)))
      setEventForm(EMPTY_EVENT); setShowEventModal(false)
      toast.success('Event created')
    } else { const data = await res.json(); setEventError(data.error || 'Failed to create event') }
  }

  const doDeleteEvent = async () => {
    if (!pendingDeleteEvent) return
    setDeletingEvent(true)
    const res = await adminFetch(`resource=events&id=${pendingDeleteEvent.id}`, { method: 'DELETE' })
    setDeletingEvent(false)
    if (res.ok) { setEvents(prev => prev.filter(e => e.id !== pendingDeleteEvent.id)); toast.success('Event deleted') }
    else toast.error('Failed to delete event')
    setPendingDeleteEvent(null)
  }

  const blockDateSubmit = async () => {
    if (!blockDate) return
    setBlockingDate(true); setBlockError('')
    const res = await adminFetch('resource=blocked-dates', { method: 'POST', body: JSON.stringify({ date: blockDate, reason: blockReason || null }) })
    setBlockingDate(false)
    if (res.ok) {
      const data = await res.json()
      setBlocked(prev => [...prev, data.blocked_date].sort((a, b) => a.date.localeCompare(b.date)))
      setBlockDate(''); setBlockReason('')
      toast.success('Date blocked')
    } else { const data = await res.json(); setBlockError(data.error || 'Failed to block date') }
  }

  const unblockDate = async (id: string) => {
    const res = await adminFetch(`resource=blocked-dates&id=${id}`, { method: 'DELETE' })
    if (res.ok) { setBlocked(prev => prev.filter(b => b.id !== id)); toast.success('Date unblocked') }
  }

  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  const cardBg = { backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.06)' }

  return (
    <div className="max-w-2xl space-y-10">
      <ConfirmModal
        open={!!pendingDeleteEvent}
        title={`Delete "${pendingDeleteEvent?.name}"?`}
        message="This special event will be permanently removed."
        confirmLabel="Delete event"
        destructive
        loading={deletingEvent}
        onConfirm={doDeleteEvent}
        onCancel={() => setPendingDeleteEvent(null)}
      />

      {/* ── Special events ── */}
      <section>
        <SectionHeader title="Special events"
          action={
            <button onClick={() => { setShowEventModal(true); setEventError('') }}
              className="text-xs bg-offwhite text-midnight font-semibold px-3 py-1.5 rounded-lg hover:bg-offwhite/90 transition-colors">
              + New event
            </button>
          } />
        <p className="text-sm text-offwhite/50 mb-4">
          Special events require a deposit at the time of booking and appear in the availability calendar.
        </p>

        {events.length === 0 ? (
          <div className="p-10 text-center rounded-2xl" style={cardBg}>
            <p className="text-sm text-offwhite/35">No special events yet.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {events.map(ev => (
                <div key={ev.id} className="rounded-2xl px-4 py-3.5" style={cardBg}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-offwhite">{ev.name}</p>
                    <button onClick={() => setPendingDeleteEvent({ id: ev.id, name: ev.name })}
                      className="text-xs text-offwhite/25 hover:text-red-400 transition-colors shrink-0">Delete</button>
                  </div>
                  <p className="text-xs text-offwhite/50 mt-1">{fmt(ev.date)}</p>
                  <div className="flex gap-3 mt-2">
                    <span className="text-xs text-offwhite/40">${ev.deposit_amount} deposit</span>
                    <span className="text-xs text-offwhite/30">·</span>
                    <span className="text-xs text-offwhite/40">refund within {ev.refund_cutoff_hours}h</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block rounded-2xl overflow-hidden" style={cardBg}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Event', 'Date', 'Deposit', 'Refund cutoff', ''].map(h => (
                      <th key={h} className="text-left text-xs text-offwhite/35 uppercase tracking-widest px-5 py-3 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map(ev => (
                    <tr key={ev.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-5 py-4 text-sm font-medium text-offwhite">{ev.name}</td>
                      <td className="px-5 py-4 text-sm text-offwhite/60">{fmt(ev.date)}</td>
                      <td className="px-5 py-4 text-sm text-offwhite/60">${ev.deposit_amount}</td>
                      <td className="px-5 py-4 text-sm text-offwhite/40">{ev.refund_cutoff_hours}h before</td>
                      <td className="px-5 py-4 text-right">
                        <button onClick={() => setPendingDeleteEvent({ id: ev.id, name: ev.name })}
                          className="text-xs text-offwhite/25 hover:text-red-400 transition-colors">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* ── Blocked dates ── */}
      <section>
        <SectionHeader title="Blocked dates" />
        <p className="text-sm text-offwhite/50 mb-4">Block dates to prevent reservations (e.g. private events, holidays, renovations).</p>
        <div className="flex gap-3 mb-4 flex-wrap">
          <input type="date" value={blockDate} onChange={e => setBlockDate(e.target.value)} className={inputCls} />
          <input type="text" value={blockReason} onChange={e => setBlockReason(e.target.value)}
            placeholder="Reason (optional)" className={`flex-1 min-w-[140px] ${inputCls}`} />
          <button onClick={blockDateSubmit} disabled={blockingDate || !blockDate}
            className="bg-offwhite text-midnight font-semibold px-4 py-2.5 rounded-xl text-sm hover:bg-offwhite/90 transition-colors disabled:opacity-40 whitespace-nowrap">
            {blockingDate ? 'Blocking…' : 'Block date'}
          </button>
        </div>
        {blockError && <p className="text-red-400 text-sm mb-3">{blockError}</p>}
        {blocked.length > 0 ? (
          <div className="rounded-2xl overflow-hidden" style={cardBg}>
            {blocked.map(b => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3.5"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <p className="text-sm font-medium text-offwhite">{fmt(b.date)}</p>
                  {b.reason && <p className="text-xs text-offwhite/40 mt-0.5">{b.reason}</p>}
                </div>
                <button onClick={() => unblockDate(b.id)}
                  className="text-xs text-offwhite/25 hover:text-red-400 transition-colors ml-3 shrink-0">Unblock</button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-offwhite/25">No blocked dates.</p>
        )}
      </section>

      {/* ── Event modal ── */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/75 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
          <div className="w-full md:max-w-md p-6 rounded-t-2xl md:rounded-2xl" style={{ backgroundColor: '#162232', border: '1px solid rgba(255,255,255,0.10)' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-satoshi font-bold text-[17px] text-offwhite">New special event</h2>
              <button onClick={() => setShowEventModal(false)} className="text-offwhite/30 hover:text-offwhite text-xl leading-none transition-colors">×</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Event name</label>
                <input value={eventForm.name} onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="New Year's Eve dinner" className={`w-full ${inputCls}`} />
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input type="date" value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))}
                  className={`w-full ${inputCls}`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Deposit (USD)</label>
                  <input type="number" min={0} value={eventForm.deposit_amount}
                    onChange={e => setEventForm(f => ({ ...f, deposit_amount: parseFloat(e.target.value) || 0 }))}
                    className={`w-full ${inputCls}`} />
                </div>
                <div>
                  <label className={labelCls}>Refund cutoff (hrs)</label>
                  <input type="number" min={0} value={eventForm.refund_cutoff_hours}
                    onChange={e => setEventForm(f => ({ ...f, refund_cutoff_hours: parseInt(e.target.value) || 0 }))}
                    className={`w-full ${inputCls}`} />
                </div>
              </div>
              {eventError && <p className="text-red-400 text-sm">{eventError}</p>}
              <div className="flex gap-3 pt-2">
                <button onClick={createEvent} disabled={savingEvent}
                  className="flex-1 bg-offwhite text-midnight font-semibold py-3 rounded-xl text-sm hover:bg-offwhite/90 transition-colors disabled:opacity-40">
                  {savingEvent ? 'Creating…' : 'Create event'}
                </button>
                <button onClick={() => setShowEventModal(false)}
                  className="px-4 py-3 text-sm text-offwhite/40 hover:text-offwhite transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
