'use client'
import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { SpecialEvent, BlockedDate } from '@/lib/types'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

interface Props {
  initialEvents: SpecialEvent[]
  initialBlocked: BlockedDate[]
  slug: string
}

const EMPTY_EVENT = { name: '', date: '', deposit_amount: 0, refund_cutoff_hours: 24 }

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

  async function adminFetch(path: string, options?: RequestInit) {
    const token = await getToken()
    return fetch(`/api/admin?${path}&tenant=${slug}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options?.headers },
    })
  }

  const createEvent = async () => {
    if (!eventForm.name || !eventForm.date || !eventForm.deposit_amount) {
      setEventError('Name, date and deposit are required')
      return
    }
    setSavingEvent(true)
    setEventError('')
    const res = await adminFetch('resource=events', {
      method: 'POST',
      body: JSON.stringify(eventForm),
    })
    setSavingEvent(false)
    if (res.ok) {
      const data = await res.json()
      setEvents(prev => [...prev, data.event].sort((a, b) => a.date.localeCompare(b.date)))
      setEventForm(EMPTY_EVENT)
      setShowEventModal(false)
    } else {
      const data = await res.json()
      setEventError(data.error || 'Failed to create event')
    }
  }

  const deleteEvent = async (id: string) => {
    if (!confirm('Delete this special event?')) return
    const res = await adminFetch(`resource=events&id=${id}`, { method: 'DELETE' })
    if (res.ok) setEvents(prev => prev.filter(e => e.id !== id))
  }

  const blockDateSubmit = async () => {
    if (!blockDate) return
    setBlockingDate(true)
    setBlockError('')
    const res = await adminFetch('resource=blocked-dates', {
      method: 'POST',
      body: JSON.stringify({ date: blockDate, reason: blockReason || null }),
    })
    setBlockingDate(false)
    if (res.ok) {
      const data = await res.json()
      setBlocked(prev => [...prev, data.blocked_date].sort((a, b) => a.date.localeCompare(b.date)))
      setBlockDate('')
      setBlockReason('')
    } else {
      const data = await res.json()
      setBlockError(data.error || 'Failed to block date')
    }
  }

  const unblockDate = async (id: string) => {
    const res = await adminFetch(`resource=blocked-dates&id=${id}`, { method: 'DELETE' })
    if (res.ok) setBlocked(prev => prev.filter(b => b.id !== id))
  }

  const fmt = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

  const section = (title: string, action?: React.ReactNode) => (
    <div className="flex items-center justify-between pb-3 border-b border-gray-800 mb-4">
      <h2 className="text-xs text-gray-500 uppercase tracking-widest font-semibold">{title}</h2>
      {action}
    </div>
  )

  return (
    <div className="max-w-2xl space-y-10">

      {/* Special events */}
      <section>
        {section(
          'Special events',
          <button
            onClick={() => { setShowEventModal(true); setEventError('') }}
            className="text-xs bg-white text-black font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            + New event
          </button>
        )}
        <p className="text-sm text-gray-400 mb-4">
          Special events require a deposit at the time of booking and appear in the availability calendar.
        </p>
        {events.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center">
            <p className="text-sm text-gray-500">No special events yet.</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Event', 'Date', 'Deposit', 'Refund cutoff', ''].map(h => (
                    <th key={h} className="text-left text-xs text-gray-500 uppercase tracking-widest px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map(ev => (
                  <tr key={ev.id} className="border-b border-gray-800/50 last:border-0">
                    <td className="px-5 py-4 text-sm font-medium text-white">{ev.name}</td>
                    <td className="px-5 py-4 text-sm text-gray-300">{fmt(ev.date)}</td>
                    <td className="px-5 py-4 text-sm text-gray-300">${ev.deposit_amount}</td>
                    <td className="px-5 py-4 text-sm text-gray-400">{ev.refund_cutoff_hours}h before</td>
                    <td className="px-5 py-4 text-right">
                      <button onClick={() => deleteEvent(ev.id)} className="text-xs text-gray-600 hover:text-red-400 transition">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Blocked dates */}
      <section>
        {section('Blocked dates')}
        <p className="text-sm text-gray-400 mb-4">
          Block dates to prevent reservations (e.g. private events, holidays, renovations).
        </p>
        <div className="flex gap-3 mb-4">
          <input
            type="date"
            value={blockDate}
            onChange={e => setBlockDate(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gray-500"
          />
          <input
            type="text"
            value={blockReason}
            onChange={e => setBlockReason(e.target.value)}
            placeholder="Reason (optional)"
            className="flex-1 bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-gray-500 placeholder:text-gray-600"
          />
          <button
            onClick={blockDateSubmit}
            disabled={blockingDate || !blockDate}
            className="bg-white text-black font-semibold px-4 py-2.5 rounded-lg text-sm hover:bg-gray-100 transition disabled:opacity-40 whitespace-nowrap"
          >
            {blockingDate ? 'Blocking…' : 'Block date'}
          </button>
        </div>
        {blockError && <p className="text-red-400 text-sm mb-3">{blockError}</p>}

        {blocked.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {blocked.map(b => (
              <div key={b.id} className="flex items-center justify-between px-5 py-4 border-b border-gray-800/50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-white">{fmt(b.date)}</p>
                  {b.reason && <p className="text-xs text-gray-500 mt-0.5">{b.reason}</p>}
                </div>
                <button onClick={() => unblockDate(b.id)} className="text-xs text-gray-600 hover:text-red-400 transition">
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
        {blocked.length === 0 && <p className="text-sm text-gray-600">No blocked dates.</p>}
      </section>

      {/* Create event modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">New special event</h2>
              <button onClick={() => setShowEventModal(false)} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block">Event name</label>
                <input
                  value={eventForm.name}
                  onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="New Year's Eve dinner"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block">Date</label>
                <input
                  type="date"
                  value={eventForm.date}
                  onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block">Deposit (USD)</label>
                  <input
                    type="number"
                    min={0}
                    value={eventForm.deposit_amount}
                    onChange={e => setEventForm(f => ({ ...f, deposit_amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 block">Refund cutoff (hrs)</label>
                  <input
                    type="number"
                    min={0}
                    value={eventForm.refund_cutoff_hours}
                    onChange={e => setEventForm(f => ({ ...f, refund_cutoff_hours: parseInt(e.target.value) || 0 }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none"
                  />
                </div>
              </div>
              {eventError && <p className="text-red-400 text-sm">{eventError}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={createEvent}
                  disabled={savingEvent}
                  className="flex-1 bg-white text-black font-semibold py-3 rounded-lg text-sm hover:bg-gray-100 transition disabled:opacity-40"
                >
                  {savingEvent ? 'Creating…' : 'Create event'}
                </button>
                <button onClick={() => setShowEventModal(false)} className="px-4 py-3 text-sm text-gray-400 hover:text-white transition">
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
