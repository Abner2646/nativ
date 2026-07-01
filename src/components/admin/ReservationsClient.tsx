'use client'
import { useState, useCallback } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { Reservation, ReservationStatus } from '@/lib/types'

async function getToken() {
  const { data: { session } } = await getBrowserSupabase().auth.getSession()
  return session?.access_token || ''
}

const STATUS_BADGE: Record<string, string> = {
  confirmed: 'bg-green-500/10 text-green-400 border border-green-500/20',
  cancelled: 'bg-red-500/10 text-red-400 border border-red-500/20',
  completed: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',
}

interface Props {
  initialReservations: Reservation[]
  slug: string
  defaultDate: string
}

export function ReservationsClient({ initialReservations, slug, defaultDate }: Props) {
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [date, setDate] = useState(defaultDate)
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)

  const fetchReservations = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin?resource=reservations&date=${d}&tenant=${slug}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      setReservations(data.reservations || [])
    } finally {
      setLoading(false)
    }
  }, [slug])

  const handleDateChange = (d: string) => {
    setDate(d)
    fetchReservations(d)
  }

  const updateStatus = async (id: string, status: ReservationStatus) => {
    setUpdating(id)
    try {
      const token = await getToken()
      const res = await fetch(`/api/admin?resource=reservations&id=${id}&tenant=${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r))
      }
    } finally {
      setUpdating(null)
    }
  }

  const filtered = statusFilter === 'all'
    ? reservations
    : reservations.filter(r => r.status === statusFilter)

  return (
    <div>
      <div className="flex gap-3 mb-6">
        <input
          type="date"
          value={date}
          onChange={e => handleDateChange(e.target.value)}
          className="bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-gray-500"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-gray-500"
        >
          <option value="all">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        {loading && <span className="text-xs text-gray-500 self-center">Loading...</span>}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
          <p className="text-gray-500 text-sm">No reservations for this date</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                {['Time', 'Guest', 'Party', 'Shift', 'Area', 'Occasion', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs text-gray-500 uppercase tracking-widest px-5 py-4 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/20 transition">
                  <td className="px-5 py-4 font-mono text-sm tabular-nums">{r.time}</td>
                  <td className="px-5 py-4">
                    <p className="text-sm font-medium text-white">{r.guest?.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{r.guest?.email}</p>
                    {r.guest?.phone && <p className="text-xs text-gray-500">{r.guest.phone}</p>}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-300">{r.party_size}</td>
                  <td className="px-5 py-4 text-sm text-gray-400">{r.shift?.name || '—'}</td>
                  <td className="px-5 py-4 text-sm text-gray-400">{r.seating_area?.name || '—'}</td>
                  <td className="px-5 py-4 text-sm text-gray-400">{r.occasion || '—'}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[r.status] || ''}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={r.status}
                      disabled={updating === r.id}
                      onChange={e => updateStatus(r.id, e.target.value as ReservationStatus)}
                      className="bg-gray-800 border border-gray-700 text-white rounded px-2 py-1 text-xs focus:outline-none disabled:opacity-50"
                    >
                      <option value="confirmed">confirmed</option>
                      <option value="completed">completed</option>
                      <option value="cancelled">cancelled</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
