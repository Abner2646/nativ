'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function UnsubscribeContent() {
  const params = useSearchParams()
  const email  = params.get('email') || ''
  const tenant = params.get('tenant') || ''
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  useEffect(() => {
    if (!email || !tenant) { setStatus('error'); return }
    setStatus('loading')
    fetch(`/api/unsubscribe?email=${encodeURIComponent(email)}&tenant=${tenant}`)
      .then(r => r.ok ? setStatus('done') : setStatus('error'))
      .catch(() => setStatus('error'))
  }, [email, tenant])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1720', fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <div style={{ maxWidth: '26rem', textAlign: 'center' }}>
        {status === 'loading' && (
          <p style={{ color: 'rgba(242,239,233,0.4)', fontSize: '0.9375rem' }}>Processing…</p>
        )}
        {status === 'done' && (
          <>
            <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', backgroundColor: 'rgba(111,143,123,0.15)', border: '1px solid rgba(111,143,123,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: '#86BBA7', fontSize: '1.25rem' }}>
              ✓
            </div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'rgba(242,239,233,0.9)', marginBottom: '0.5rem' }}>
              Unsubscribed
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'rgba(242,239,233,0.4)', lineHeight: 1.6 }}>
              {email} has been removed from the mailing list. You won&apos;t receive any more marketing emails.
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'rgba(242,239,233,0.9)', marginBottom: '0.5rem' }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'rgba(242,239,233,0.4)' }}>
              This unsubscribe link may be invalid or expired.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function UnsubscribePage() {
  return (
    <Suspense>
      <UnsubscribeContent />
    </Suspense>
  )
}
