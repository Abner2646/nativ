'use client'
import { useState } from 'react'
import type { Theme } from '@/lib/theme'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function fmtDate(d: string) {
  const [, m, day] = d.split('-').map(Number)
  return `${MONTHS[m - 1]} ${day}`
}

interface Props {
  token: string
  reservation: { date: string; time: string; party_size: number; guestName: string; guestEmail: string }
  restaurantName: string
  theme: Theme
}

export function CancelClient({ token, reservation: r, restaurantName, theme: t }: Props) {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [refunded, setRefunded] = useState(false)
  const [error, setError]     = useState('')

  const handleCancel = async () => {
    if (email.toLowerCase().trim() !== r.guestEmail.toLowerCase()) {
      setError('The email does not match the one used for this reservation.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/reservations?action=cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not cancel the reservation.'); setLoading(false); return }
      setRefunded(!!data.refunded)
      setDone(true)
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  const label: React.CSSProperties = {
    display: 'block', fontSize: '0.6875rem', fontWeight: 600,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    color: t.faint, marginBottom: '0.5rem', fontFamily: t.font,
  }

  if (done) {
    return (
      <main style={{ minHeight: '100vh', backgroundColor: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: t.font }}>
        <div style={{ maxWidth: '24rem', width: '100%', textAlign: 'center' }}>
          <div style={{
            width: '3.5rem', height: '3.5rem', borderRadius: '50%',
            backgroundColor: `${t.primary}1a`, border: `1.5px solid ${t.primary}50`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem', fontSize: '1.375rem', color: t.primary,
          }}>✓</div>
          <h1 style={{ color: t.text, fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.625rem' }}>
            Reservation cancelled
          </h1>
          <p style={{ color: t.muted, fontSize: '0.9375rem', lineHeight: 1.65 }}>
            Your reservation at <strong style={{ color: t.text }}>{restaurantName}</strong> on{' '}
            {fmtDate(r.date)} at {r.time} has been cancelled.
          </p>
          {refunded && (
            <p style={{
              color: t.primary, fontSize: '0.875rem', marginTop: '1rem',
              backgroundColor: `${t.primary}12`, border: `1px solid ${t.primary}30`,
              borderRadius: '0.5rem', padding: '0.625rem 0.875rem',
            }}>
              Your deposit has been refunded and will appear on your statement within a few business days.
            </p>
          )}
          <p style={{ color: t.faint, fontSize: '0.8125rem', marginTop: '1.25rem' }}>
            We hope to see you another time.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', backgroundColor: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: t.font }}>
      <div style={{ maxWidth: '24rem', width: '100%' }}>

        <h1 style={{ color: t.text, fontSize: '1.25rem', fontWeight: 700, textAlign: 'center', marginBottom: '0.25rem' }}>
          Cancel reservation
        </h1>
        <p style={{ color: t.muted, fontSize: '0.875rem', textAlign: 'center', marginBottom: '1.75rem' }}>
          {restaurantName}
        </p>

        {/* Reservation summary */}
        <div style={{
          backgroundColor: t.surface, border: `1px solid ${t.border}`,
          borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem',
        }}>
          <p style={{ color: t.text, fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
            {fmtDate(r.date)} at {r.time}
          </p>
          <p style={{ color: t.muted, fontSize: '0.8125rem' }}>
            {r.party_size} {r.party_size === 1 ? 'guest' : 'guests'} · {r.guestName}
          </p>
        </div>

        {/* Email confirmation */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={label}>Confirm with your email</label>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            placeholder="your@email.com"
            style={{
              width: '100%', boxSizing: 'border-box',
              backgroundColor: t.input, border: `1px solid ${t.border}`,
              color: t.text, borderRadius: t.btnRadius,
              padding: '0.75rem 1rem', fontSize: '0.9375rem',
              fontFamily: t.font, outline: 'none', display: 'block',
            }}
          />
        </div>

        {error && (
          <p style={{
            backgroundColor: t.errorBg, border: `1px solid ${t.errorBorder}`,
            borderRadius: '0.5rem', padding: '0.75rem 1rem',
            color: t.errorText, fontSize: '0.8125rem', marginBottom: '1rem',
          }}>
            {error}
          </p>
        )}

        <button
          onClick={handleCancel}
          disabled={!email || loading}
          style={{
            width: '100%', backgroundColor: '#dc2626', color: '#fff',
            fontWeight: 700, fontSize: '0.9375rem', padding: '0.875rem',
            borderRadius: t.btnRadius, border: 'none',
            cursor: !email || loading ? 'not-allowed' : 'pointer',
            opacity: !email || loading ? 0.5 : 1,
            fontFamily: t.font,
          }}
        >
          {loading ? 'Cancelling…' : 'Cancel reservation'}
        </button>

        <p style={{ color: t.faint, fontSize: '0.75rem', textAlign: 'center', marginTop: '1.25rem' }}>
          This action cannot be undone.
        </p>
      </div>
    </main>
  )
}
