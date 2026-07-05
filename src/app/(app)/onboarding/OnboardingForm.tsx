'use client'
import { useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase-browser'
import { getAppDomain } from '@/lib/domain'

const supabase = getBrowserSupabase()

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export function OnboardingForm() {
  const [mode, setMode]         = useState<'choose' | 'create' | 'join'>('choose')
  const [name, setName]         = useState('')
  const [slug, setSlug]         = useState('')
  const [token, setToken]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleCreate = async () => {
    setLoading(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = '/login'; return }

    const pendingRef = localStorage.getItem('nativ_pending_ref') || ''
    localStorage.removeItem('nativ_pending_ref')
    const refParam = pendingRef ? `?ref=${encodeURIComponent(pendingRef)}` : ''

    const res = await fetch(`/api/register${refParam}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ name, slug }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Something went wrong'); setLoading(false); return }
    window.location.href = `/restaurant/${slug}`
  }

  const handleJoin = async () => {
    setLoading(true); setError('')
    const trimmed = token.trim()
    if (!trimmed) { setError('Enter your invite token'); setLoading(false); return }

    const res = await fetch(`/api/register?token=${encodeURIComponent(trimmed)}`, {
      method: 'PUT',
    })
    const data = await res.json()
    if (!res.ok) {
      const msg: Record<number, string> = {
        404: 'Invite not found. Check the link in your email.',
        409: 'This invite has already been used.',
        410: 'This invite has expired. Ask the restaurant admin to send a new one.',
      }
      setError(msg[res.status] || data.error || 'Something went wrong')
      setLoading(false)
      return
    }
    window.location.href = '/dashboard'
  }

  const domain = getAppDomain()

  // ── Step 0: choose path ──────────────────────────────────────
  if (mode === 'choose') {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-bold mb-2">Welcome to Nativ</h1>
          <p className="text-gray-500 text-sm mb-10">What would you like to do?</p>
          <div className="space-y-4">
            <button onClick={() => setMode('create')}
              className="w-full text-left bg-gray-900 border border-gray-700 hover:border-gray-500 rounded-xl px-6 py-5 transition">
              <p className="font-semibold text-white mb-1">Create a new restaurant</p>
              <p className="text-sm text-gray-500">Set up your reservation system from scratch.</p>
            </button>
            <button onClick={() => setMode('join')}
              className="w-full text-left bg-gray-900 border border-gray-700 hover:border-gray-500 rounded-xl px-6 py-5 transition">
              <p className="font-semibold text-white mb-1">Join an existing restaurant</p>
              <p className="text-sm text-gray-500">You received an invite from a restaurant admin.</p>
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ── Step 1b: join with invite token ─────────────────────────
  if (mode === 'join') {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <button onClick={() => { setMode('choose'); setError('') }}
            className="text-gray-500 text-sm mb-8 hover:text-gray-300 transition">
            ← Back
          </button>
          <h1 className="text-3xl font-bold mb-2">Accept your invite</h1>
          <p className="text-gray-500 text-sm mb-8">
            Paste the invite token from the email you received.
          </p>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Paste invite token here"
              value={token}
              onChange={e => setToken(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gray-400 font-mono text-sm"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={handleJoin} disabled={loading || !token.trim()}
              className="w-full bg-white text-black font-semibold py-4 rounded-lg hover:bg-gray-100 transition disabled:opacity-40">
              {loading ? 'Joining…' : 'Join restaurant'}
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ── Step 1a: create restaurant ───────────────────────────────
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <button onClick={() => { setMode('choose'); setError('') }}
          className="text-gray-500 text-sm mb-8 hover:text-gray-300 transition">
          ← Back
        </button>
        <h1 className="text-3xl font-bold mb-2">Create your restaurant</h1>
        <p className="text-gray-500 text-sm mb-8">You can add more restaurants later from your dashboard.</p>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Restaurant name</label>
            <input type="text" placeholder="Your restaurant name" value={name}
              onChange={e => { setName(e.target.value); setSlug(slugify(e.target.value)) }}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gray-400" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Your reservation URL</label>
            <div className="flex items-center bg-gray-900 border border-gray-700 rounded-lg px-4 py-3">
              <input type="text" value={slug} onChange={e => setSlug(slugify(e.target.value))}
                className="bg-transparent text-white flex-1 focus:outline-none min-w-0" />
              {domain && <span className="text-gray-500 text-sm whitespace-nowrap">.{domain}</span>}
            </div>
            {slug && domain && (
              <p className="text-xs text-gray-600 mt-1">
                Your guests will book at <span className="text-gray-400">{slug}.{domain}</span>
              </p>
            )}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button onClick={handleCreate} disabled={loading || !name || !slug}
            className="w-full bg-white text-black font-semibold py-4 rounded-lg hover:bg-gray-100 transition disabled:opacity-40">
            {loading ? 'Creating…' : 'Create restaurant'}
          </button>
        </div>
      </div>
    </main>
  )
}
